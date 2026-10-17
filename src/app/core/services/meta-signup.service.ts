import { HttpClient } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, NgZone } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CompleteMetaSignupRequest, MetaSignupClientConfig, MetaSignupResult } from '../models/meta-signup.model';

export const META_SDK_SCRIPT = 'https://connect.facebook.net/en_US/sdk.js';

interface FacebookSdk {
  init(options: Record<string, unknown>): void;
  login(callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
  }
}

/** How long to wait, after the login callback, for Meta's separate "which account and number" message. */
const SESSION_INFO_WAIT_MS = 2000;
/** How long the sign-up popup may stay open without reporting anything before the page stops waiting. */
const SIGNUP_TIMEOUT_MS = 120_000;

/** Meta's sign-up popup never reported back - typically because the Meta app is not approved to onboard customers yet. */
export class MetaSignupTimeoutError extends Error {
  constructor() {
    super('Meta did not finish the sign-up.');
    this.name = 'MetaSignupTimeoutError';
  }
}

/**
 * "Connect with Meta": WhatsApp Embedded Signup. The browser only runs Meta's own popup - the tenant signs in to Meta there, and
 * this app never sees a password. What comes back (a one-time code and the ids Meta reports) is handed to the API, which does
 * everything else and re-checks it all with Meta. The SDK is loaded when the button is pressed, not on app start.
 */
@Injectable({ providedIn: 'root' })
export class MetaSignupService {
  private readonly baseUrl = `${environment.apiBaseUrl}/tenant-settings/whatsapp/meta-signup`;
  private loading: Promise<FacebookSdk> | null = null;
  private initialisedFor: string | null = null;

  constructor(private readonly http: HttpClient, @Inject(DOCUMENT) private readonly document: Document, private readonly zone: NgZone) {}

  getConfig(): Observable<MetaSignupClientConfig> {
    return this.http.get<MetaSignupClientConfig>(`${this.baseUrl}/config`);
  }

  /** Where each step stands now, read from Meta with the saved credentials. */
  getStatus(): Observable<MetaSignupResult> {
    return this.http.get<MetaSignupResult>(`${this.baseUrl}/status`);
  }

  complete(request: CompleteMetaSignupRequest): Observable<MetaSignupResult> {
    return this.http.post<MetaSignupResult>(`${this.baseUrl}/complete`, request);
  }

  /** Carries on from the first step not done, with the credentials already saved. */
  resume(): Observable<MetaSignupResult> {
    return this.http.post<MetaSignupResult>(`${this.baseUrl}/resume`, {});
  }

  /**
   * Opens Meta's sign-up popup and resolves when it closes. Never rejects for something the tenant did (closing the popup, saying no):
   * that resolves as a CANCEL/ERROR for the API to explain. Rejects only when the SDK itself cannot be loaded.
   */
  launch(config: MetaSignupClientConfig): Promise<CompleteMetaSignupRequest> {
    return this.loadSdk(config).then(
      (fb) =>
        new Promise<CompleteMetaSignupRequest>((resolve, reject) => {
          const result: CompleteMetaSignupRequest = {
            code: null,
            wabaId: null,
            phoneNumberId: null,
            clientEvent: null,
            clientStep: null,
            clientErrorMessage: null,
            pageUrl: this.document.location?.href ?? null,
          };
          let loginDone = false;
          let finished = false;
          let timer: ReturnType<typeof setTimeout> | undefined;

          const settle = () => {
            if (finished) {
              return;
            }
            finished = true;
            window.removeEventListener('message', onMessage);
            if (timer) {
              clearTimeout(timer);
            }
            clearTimeout(hardTimer);
            if (!result.code && !result.clientEvent) {
              result.clientEvent = 'CANCEL'; // the popup closed without granting anything
            }
            this.zone.run(() => resolve(result));
          };

          const startedAt = Date.now();
          const seconds = () => Math.round((Date.now() - startedAt) / 100) / 10;

          const onMessage = (event: MessageEvent) => {
            let data: { type?: string; event?: string; data?: Record<string, unknown> } | null = null;
            try {
              data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            } catch {
              data = null;
            }
            // Trace of every message another window sends while the popup is open, for diagnosing a sign-up that does not finish:
            // where it came from, its type and event name, and the NAMES of the fields it carries - never their values (no ids, codes
            // or tokens). Messages from this page itself (the dev server's own) are left out.
            if (event.origin !== window.location.origin) {
              console.info('[meta-signup] message', {
                afterSeconds: seconds(),
                origin: event.origin,
                fromMeta: /^https:\/\/([a-z0-9-]+\.)?facebook\.com$/.test(event.origin),
                type: data && typeof data === 'object' ? data.type ?? null : typeof event.data,
                event: data && typeof data === 'object' ? data.event ?? null : null,
                fields: data?.data && typeof data.data === 'object' ? Object.keys(data.data) : [],
              });
            }
            if (!/^https:\/\/([a-z0-9-]+\.)?facebook\.com$/.test(event.origin)) {
              return; // only Meta's own pages
            }
            if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') {
              return;
            }
            const info = data.data ?? {};
            if (data.event === 'FINISH' || data.event === 'FINISH_ONLY_WABA' || data.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') {
              result.clientEvent = 'FINISH';
              result.wabaId = typeof info['waba_id'] === 'string' ? (info['waba_id'] as string) : null;
              result.phoneNumberId = typeof info['phone_number_id'] === 'string' ? (info['phone_number_id'] as string) : null;
            } else if (data.event === 'CANCEL') {
              result.clientEvent = 'CANCEL';
              result.clientStep = typeof info['current_step'] === 'string' ? (info['current_step'] as string) : null;
              result.clientErrorMessage = typeof info['error_message'] === 'string' ? (info['error_message'] as string) : null;
            } else if (data.event === 'ERROR') {
              result.clientEvent = 'ERROR';
              result.clientErrorMessage = typeof info['error_message'] === 'string' ? (info['error_message'] as string) : null;
            }
            if (loginDone) {
              settle();
            }
          };
          window.addEventListener('message', onMessage);

          // Meta can leave the popup on a screen that never reports back (for example "can't onboard customers right now" when the app
          // is not yet approved for Embedded Signup): no code, no finish message, no close. Stop waiting rather than hang the page.
          const hardTimer = setTimeout(() => {
            if (finished) {
              return;
            }
            finished = true;
            window.removeEventListener('message', onMessage);
            if (timer) {
              clearTimeout(timer);
            }
            console.warn('[meta-signup] gave up waiting for Meta', { afterSeconds: seconds(), loginDone });
            this.zone.run(() => reject(new MetaSignupTimeoutError()));
          }, SIGNUP_TIMEOUT_MS);

          fb.login(
            (response) => {
              loginDone = true;
              result.code = response.authResponse?.code ?? null;
              console.info('[meta-signup] FB.login callback', {
                afterSeconds: seconds(),
                status: (response as { status?: string }).status ?? null,
                hasAuthResponse: !!response.authResponse,
                hasCode: !!result.code,
                authResponseFields: response.authResponse ? Object.keys(response.authResponse) : [],
                finishMessageSeenAlready: !!result.clientEvent,
              });
              // The "which number" message normally arrives around the same time; give it a moment, then go on regardless -
              // the API finds the account and number itself when they are missing.
              if (result.clientEvent || !result.code) {
                settle();
              } else {
                timer = setTimeout(settle, SESSION_INFO_WAIT_MS);
              }
            },
            {
              config_id: config.configurationId,
              response_type: 'code',
              override_default_response_type: true,
              // Exactly what Meta generates for an Embedded Signup v4 configuration (App Dashboard > Facebook Login for Business >
              // Configurations > the code sample); the older { setup, featureType, sessionInfoVersion } form is for earlier versions.
              extras: { version: 'v4' },
            }
          );
        })
    );
  }

  private loadSdk(config: MetaSignupClientConfig): Promise<FacebookSdk> {
    if (window.FB && this.initialisedFor === config.appId) {
      return Promise.resolve(window.FB);
    }
    this.loading ??= new Promise<FacebookSdk>((resolve, reject) => {
      const script = this.document.createElement('script');
      script.src = META_SDK_SCRIPT;
      script.async = true;
      script.defer = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => (window.FB ? resolve(window.FB) : reject(new Error('Meta sign-in did not start.')));
      script.onerror = () => {
        this.loading = null;
        reject(new Error('Meta sign-in could not be loaded. Check the network, an ad blocker, or the Content-Security-Policy.'));
      };
      this.document.head.appendChild(script);
    });
    return this.loading.then((fb) => {
      if (this.initialisedFor !== config.appId) {
        fb.init({ appId: config.appId, cookie: true, xfbml: false, version: config.apiVersion });
        this.initialisedFor = config.appId;
      }
      return fb;
    });
  }
}
