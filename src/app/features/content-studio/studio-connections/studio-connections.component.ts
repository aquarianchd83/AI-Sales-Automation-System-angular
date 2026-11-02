import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ConnectionsOverview, SocialConnection, connectionsRedirectUri } from '../../../core/models/content-planner.model';
import { ContentPlannerService } from '../../../core/services/content-planner.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

export const CONNECTIONS_PATH = '/content-studio/connections';

/**
 * The accounts videos can be published to. Connecting sends the Admin to Google and back to this page with a one-time code, which is
 * exchanged for access on the server - the browser never sees a token, and none is ever shown. Disconnecting asks Google to revoke access and
 * stops anything that was still waiting to go out through the account.
 */
@Component({
  selector: 'app-studio-connections',
  templateUrl: './studio-connections.component.html',
  styleUrls: ['./studio-connections.component.scss'],
})
export class StudioConnectionsComponent implements OnInit {
  overview: ConnectionsOverview | null = null;
  loading = true;
  loadFailed = false;
  busy = false;
  completing = false;
  message: string | null = null;

  constructor(
    private readonly planner: ContentPlannerService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    const state = params.get('state');
    if (params.get('error')) {
      this.message = 'The Google sign-in was cancelled, so nothing was connected.';
      this.clearQuery();
    } else if (code && state) {
      this.completeLogin(code, state);
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.planner
      .connections()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (o) => (this.overview = o), error: () => (this.loadFailed = true) });
  }

  /** Sends the Admin to Google; they come back to this page with a one-time code. */
  connect(): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.planner
      .youTubeConnectUrl(connectionsRedirectUri(window.location.origin))
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: ({ url }) => window.location.assign(url),
        // ErrorInterceptor shows why (for example that the platform has no Google client set up yet).
        error: () => undefined,
      });
  }

  disconnect(connection: SocialConnection): void {
    const data: ConfirmDialogData = {
      title: 'Disconnect this account?',
      message: `"${connection.accountName}" is disconnected and Google is asked to revoke access. Anything still waiting to be published through it is cancelled. Videos already on YouTube stay there.`,
      confirmLabel: 'Disconnect',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '480px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.planner.disconnect(connection.id).subscribe({
          next: () => {
            if (this.overview) {
              this.overview = { ...this.overview, connections: this.overview.connections.filter((c) => c.id !== connection.id) };
            }
            this.notify.success('Disconnected.');
          },
          error: () => undefined,
        });
      });
  }

  private completeLogin(code: string, state: string): void {
    this.completing = true;
    this.loading = false;
    this.planner
      .connectYouTube(code, state, connectionsRedirectUri(window.location.origin))
      .pipe(finalize(() => (this.completing = false)))
      .subscribe({
        next: (connection) => {
          this.clearQuery();
          this.notify.success(`Connected "${connection.accountName}".`);
          this.load();
        },
        error: () => {
          // ErrorInterceptor shows why (expired sign-in, no channel, a permission left out). Drop the used-up code and show the page as it is.
          this.clearQuery();
          this.load();
        },
      });
  }

  private clearQuery(): void {
    void this.router.navigate([CONNECTIONS_PATH], { replaceUrl: true });
  }
}
