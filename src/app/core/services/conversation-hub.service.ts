import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder, IRetryPolicy, LogLevel, RetryContext } from '@microsoft/signalr';
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

/** Payload of the "MessageStatusUpdated" hub event — an outbound message's delivery status
 * advanced (Sent/Delivered/Read/Failed), see SignalRNotificationService/INotificationService on
 * the backend. `status` is the new MessageStatus name (e.g. "Read"). */
export interface MessageStatusUpdatedEvent {
  conversationId: string;
  messageId: string;
  status: string;
}

/**
 * SignalR's own `withAutomaticReconnect()` (no args) retries after 0/2/10/30s and then, if the
 * connection is still down, GIVES UP for good — the HubConnection sits in "Disconnected" and never
 * tries again on its own. Observed in practice against this hub: a proxied dev connection
 * (ng serve → backend) can drop and fail to reconnect within that ~42s window, which then silently
 * kills every live update (message status, new inbound message, handoffs) for the rest of the
 * session until the user manually reloads the page — exactly the "I have to refresh to see it"
 * symptom this hub exists to avoid. Retrying forever at a capped interval instead means a bad
 * network blip (or a flaky proxy) self-heals instead of requiring a reload.
 */
class InfiniteRetryPolicy implements IRetryPolicy {
  private static readonly delaysMs = [0, 2000, 5000, 10000, 15000, 30000];

  nextRetryDelayInMilliseconds(retryContext: RetryContext): number {
    const { previousRetryCount } = retryContext;
    return InfiniteRetryPolicy.delaysMs[previousRetryCount] ?? InfiniteRetryPolicy.delaysMs[InfiniteRetryPolicy.delaysMs.length - 1];
  }
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
  private readonly messageStatusUpdatedSubject = new Subject<MessageStatusUpdatedEvent>();
  private readonly reconnectedSubject = new Subject<void>();

  readonly newInboundMessage$: Observable<NewInboundMessageEvent> = this.newInboundMessageSubject.asObservable();
  readonly newHandoff$: Observable<NewHandoffEvent> = this.newHandoffSubject.asObservable();
  readonly messageStatusUpdated$: Observable<MessageStatusUpdatedEvent> = this.messageStatusUpdatedSubject.asObservable();
  /** Fires once a dropped connection comes back. `Clients.All.SendAsync` on the backend only ever
   * reaches clients connected at broadcast time — nothing is queued for one that's mid-reconnect —
   * so anything that happened while this client was down (however briefly) is otherwise lost until
   * a manual reload. Callers use this to resync (refetch) the page they have open. */
  readonly reconnected$: Observable<void> = this.reconnectedSubject.asObservable();

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
      .withAutomaticReconnect(new InfiniteRetryPolicy())
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('NewInboundMessage', (event: NewInboundMessageEvent) => this.newInboundMessageSubject.next(event));
    connection.on('NewHandoff', (event: NewHandoffEvent) => this.newHandoffSubject.next(event));
    connection.on('MessageStatusUpdated', (event: MessageStatusUpdatedEvent) => this.messageStatusUpdatedSubject.next(event));
    connection.onreconnected(() => this.reconnectedSubject.next());

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
