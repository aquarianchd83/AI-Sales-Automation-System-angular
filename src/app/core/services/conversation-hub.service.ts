import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, LogLevel } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TokenStorageService } from './token-storage.service';

/** Payload of the "NewInboundMessage" hub event — see SignalRNotificationService on the backend. */
export interface NewInboundMessageEvent {
  conversationId: string;
  customerId: string;
  textPreview: string | null;
}

/** Payload of the "NewHandoff" hub event. */
export interface NewHandoffEvent {
  handoffId: string;
  conversationId: string;
  triggerReason: string;
}

/**
 * Client for ConversationHub (/hubs/conversations) — the Agent Inbox's real-time channel. No
 * client-callable hub methods exist server-side; this just connects and listens. The backend
 * broadcasts to every connected client rather than per-conversation groups (see
 * SignalRNotificationService's remarks), so every subscriber here gets every event regardless of
 * which conversation, if any, is actually open — callers filter by conversationId themselves.
 *
 * Connection lifecycle is tied to the authenticated session, not any one page: ShellComponent
 * calls connect() on init and disconnect() on destroy, so it survives navigating between
 * Inbox/Handoffs/elsewhere and tears down on logout.
 */
@Injectable({ providedIn: 'root' })
export class ConversationHubService {
  private connection: HubConnection | null = null;

  private readonly newInboundMessageSubject = new Subject<NewInboundMessageEvent>();
  private readonly newHandoffSubject = new Subject<NewHandoffEvent>();

  readonly newInboundMessage$: Observable<NewInboundMessageEvent> = this.newInboundMessageSubject.asObservable();
  readonly newHandoff$: Observable<NewHandoffEvent> = this.newHandoffSubject.asObservable();

  constructor(private readonly tokens: TokenStorageService) {}

  connect(): void {
    if (this.connection) {
      return;
    }

    const connection = new HubConnectionBuilder()
      .withUrl(`${environment.hubBaseUrl}/conversations`, {
        // Browsers' WebSocket API cannot attach an Authorization header — the backend's JWT
        // bearer handler reads this as an "access_token" query param instead, scoped to /hubs
        // only. Re-read on every (re)connect attempt rather than captured once, so a token
        // refreshed elsewhere while this connection is alive still gets picked up.
        accessTokenFactory: () => this.tokens.accessToken ?? '',
      })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('NewInboundMessage', (event: NewInboundMessageEvent) => this.newInboundMessageSubject.next(event));
    connection.on('NewHandoff', (event: NewHandoffEvent) => this.newHandoffSubject.next(event));

    // A failed/lost connection must not block using the app — every page this feeds already
    // works via its own manual refresh/reload; live updates are a convenience on top, not a hard
    // dependency. withAutomaticReconnect handles transient drops; a start() failure here just
    // means no live updates until the next connect() call (e.g. the next login).
    connection.start().catch((error) => console.warn('[ConversationHub] connection failed', error));

    this.connection = connection;
  }

  disconnect(): void {
    if (!this.connection) {
      return;
    }
    const connection = this.connection;
    this.connection = null;
    void connection.stop();
  }
}
