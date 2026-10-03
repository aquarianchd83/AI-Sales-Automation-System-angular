import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  PlatformMessageTemplate,
  PlatformTemplateSyncResult,
  renderTemplatePreview,
} from '../../../core/models/platform-whatsapp.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformMessageTemplatesService } from '../../../core/services/platform-message-templates.service';
import { PlatformWhatsAppSettingsService } from '../../../core/services/platform-whatsapp-settings.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { mediaPreviewUrl } from '../../../core/models/media.model';
import { environment } from '../../../../environments/environment';
import { PlatformTemplateEditDialogComponent, PlatformTemplateEditData } from '../platform-template-edit-dialog/platform-template-edit-dialog.component';
import { PlatformTemplateTestDialogComponent } from '../platform-template-test-dialog/platform-template-test-dialog.component';

/**
 * The Platform Admin Console's Notice Templates page: the WhatsApp template behind each kind of notice a tenant gets from the platform (plan
 * expiring, credits running out ...). They are seeded at startup, one per notice, and from then on the admin's: reword them, give them an
 * image, switch one off, send them to Meta for review. A notice only goes on WhatsApp once Meta has approved its template; until then the
 * tenant still gets it by email and in-app.
 */
@Component({
  selector: 'app-platform-message-templates',
  templateUrl: './platform-message-templates.component.html',
  styleUrls: ['./platform-message-templates.component.scss'],
})
export class PlatformMessageTemplatesComponent implements OnInit {
  templates: PlatformMessageTemplate[] = [];
  loading = true;
  loadFailed = false;
  syncing = false;
  /** Whether the platform number can reach Meta; null until known. */
  canManageTemplates: boolean | null = null;
  syncResult: PlatformTemplateSyncResult | null = null;
  busyId: string | null = null;

  readonly preview = (t: PlatformMessageTemplate): string => renderTemplatePreview(t.bodyText, t.sampleMessage);
  readonly imageUrl = (url: string): string => mediaPreviewUrl(url, environment.apiBaseUrl);

  constructor(
    private readonly api: PlatformMessageTemplatesService,
    private readonly settings: PlatformWhatsAppSettingsService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  get approvedCount(): number {
    return this.templates.filter((t) => t.status === 'Approved' && t.isActive).length;
  }

  ngOnInit(): void {
    this.load();
    this.settings.get().subscribe({
      next: (s) => (this.canManageTemplates = s.canManageTemplates),
      error: () => (this.canManageTemplates = null),
    });
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.api
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (templates) => (this.templates = templates),
        error: () => (this.loadFailed = true),
      });
  }

  /** What the badge says: what Meta decided, or what is left to do. */
  statusLabel(t: PlatformMessageTemplate): string {
    if (!t.metaTemplateId) {
      return t.status === 'Pending' ? 'Not sent to Meta yet' : t.status;
    }
    return t.status === 'Pending' ? 'In review at Meta' : t.status;
  }

  /** Whether a notice using this template goes out on WhatsApp right now. */
  isLive(t: PlatformMessageTemplate): boolean {
    return t.isActive && t.status === 'Approved';
  }

  edit(t: PlatformMessageTemplate): void {
    this.dialog
      .open<PlatformTemplateEditDialogComponent, PlatformTemplateEditData, PlatformMessageTemplate | undefined>(
        PlatformTemplateEditDialogComponent,
        { data: { template: t }, width: '860px', maxWidth: '96vw', disableClose: true }
      )
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.replace(updated);
          this.notify.success(
            updated.status === 'Pending' && t.status === 'Approved'
              ? 'Saved. Meta has to review the new wording before this notice goes on WhatsApp again - press Sync with Meta.'
              : 'Saved.'
          );
        }
      });
  }

  /** The on/off switch: whether this notice goes on WhatsApp at all. Meta's review status is separate. */
  toggleActive(t: PlatformMessageTemplate, isActive: boolean): void {
    this.busyId = t.id;
    this.api
      .update(t.id, { name: t.name, bodyText: t.bodyText, isActive, headerMediaAssetId: null, removeHeaderImage: false })
      .pipe(finalize(() => (this.busyId = null)))
      .subscribe({
        next: (updated) => this.replace(updated),
        error: () => this.load(),
      });
  }

  syncAll(): void {
    if (this.syncing) {
      return;
    }
    this.syncing = true;
    this.syncResult = null;
    this.api
      .sync()
      .pipe(finalize(() => (this.syncing = false)))
      .subscribe({
        next: (result) => {
          this.syncResult = result;
          if (result.configured) {
            this.load();
          }
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  syncOne(t: PlatformMessageTemplate): void {
    this.busyId = t.id;
    this.api
      .syncOne(t.id)
      .pipe(finalize(() => (this.busyId = null)))
      .subscribe({
        next: (updated) => {
          this.replace(updated);
          this.notify.success(`${updated.name}: ${this.statusLabel(updated)}.`);
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  sendTest(t: PlatformMessageTemplate): void {
    this.dialog.open(PlatformTemplateTestDialogComponent, { data: t, width: '480px', maxWidth: '96vw' });
  }

  restoreDefault(t: PlatformMessageTemplate): void {
    const data: ConfirmDialogData = {
      title: `Restore the default text for "${t.name}"?`,
      message:
        'Your wording is replaced with the text this notice started with. ' +
        (t.status === 'Approved' ? 'Meta has to review it again before the notice goes on WhatsApp.' : ''),
      confirmLabel: 'Restore',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.busyId = t.id;
        this.api
          .restoreDefault(t.id)
          .pipe(finalize(() => (this.busyId = null)))
          .subscribe({
            next: (updated) => {
              this.replace(updated);
              this.notify.success('Default text restored.');
            },
            error: () => {
              // ErrorInterceptor toasts it.
            },
          });
      });
  }

  trackById(_: number, t: PlatformMessageTemplate): string {
    return t.id;
  }

  private replace(updated: PlatformMessageTemplate): void {
    this.templates = this.templates.map((t) => (t.id === updated.id ? updated : t));
  }
}
