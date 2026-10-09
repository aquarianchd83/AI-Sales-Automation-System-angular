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
        new Promise<CompleteMetaSignupRequest>((resolve) => {
          const result: CompleteMetaSignupRequest = {
            code: null,
            wabaId: null,
            phoneNumberId: null,
            clientEvent: null,
            clientStep: null,
            clientErrorMessage: null,
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
            if (!result.code && !result.clientEvent) {
              result.clientEvent = 'CANCEL'; // the popup closed without granting anything
            }
            this.zone.run(() => resolve(result));
          };

          const onMessage = (event: MessageEvent) => {
            if (!/^https:\/\/([a-z0-9-]+\.)?facebook\.com$/.test(event.origin)) {
              return; // only Meta's own pages
            }
            let data: { type?: string; event?: string; data?: Record<string, unknown> } | null = null;
            try {
              data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            } catch {
              return;
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

          fb.login(
            (response) => {
              loginDone = true;
              result.code = response.authResponse?.code ?? null;
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
              extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
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
