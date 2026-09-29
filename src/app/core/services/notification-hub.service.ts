import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { TokenStorageService } from './token-storage.service';

/**
 * Client for the /hubs/notifications SignalR channel — the live half of the tenant/platform bells.
 * The server places a connection into exactly one group (the signed-in tenant, or the shared
 * platform-operator group) based on the JWT it connects with, so this service only has to expose
 * "a notification arrived" and let ShellComponent decide which bell it belongs to.
 *
 * A dropped or failed connection is never surfaced as an app error: ShellComponent's own polling
 * is the fallback that keeps both bells eventually consistent even with no live channel at all.
 */
@Injectable({ providedIn: 'root' })
export class NotificationHubService {
  private connection: signalR.HubConnection | null = null;
  private readonly received$ = new Subject<unknown>();
  private readonly jobFinished$ = new Subject<string>();

  constructor(private readonly tokenStorage: TokenStorageService) {}

  /** Emits the job type each time one of the tenant's background jobs finishes a run (any outcome),
   * already recorded server-side — so a page showing what that job changes can simply refetch. Only
   * `types` are passed through; pass none to hear every job. */
  jobFinished(types?: readonly string[]): Observable<string> {
    return this.jobFinished$.pipe(filter((jobType) => !types || types.includes(jobType)));
  }

  /** Emits the same DTO shape the REST list endpoint already returns for that bell — a
   * TenantNotification or a PlatformNotification, depending on which group delivered it. */
  get notificationReceived$(): Observable<unknown> {
    return this.received$.asObservable();
  }

  /** Idempotent, so ShellComponent can call it once per session with no "already connected" guard
   * of its own. */
  connect(): void {
    if (this.connection) {
      return;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.notificationsHubUrl, {
        accessTokenFactory: () => this.tokenStorage.accessToken ?? '',
      })
      .withAutomaticReconnect()
      .build();

    connection.on('NotificationReceived', (payload: unknown) => this.received$.next(payload));
    connection.on('JobFinished', (payload: { jobType?: string } | null) => {
      if (payload?.jobType) {
        this.jobFinished$.next(payload.jobType);
      }
    });
    this.connection = connection;
    connection.start().catch(() => undefined);
  }

  disconnect(): void {
    const connection = this.connection;
    this.connection = null;
    connection?.stop().catch(() => undefined);
  }
}
