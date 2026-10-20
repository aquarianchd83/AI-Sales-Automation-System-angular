import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { KnowledgeVersion, KnowledgeVersionDetail, KnowledgeVersionsOverview } from '../../../core/models/published-knowledge.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PublishedKnowledgeService } from '../../../core/services/published-knowledge.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** The id of the "next version" entry at the top of the list, which is not a version yet. */
export const NEXT = 'next';

/**
 * What the tenant has published. The answers they approved go into a version; a version is a record that never changes - publishing again
 * makes the next one, and restoring an old one makes a new version that copies it. Approved answers that need another look (a source changed,
 * a price lapsed, test data, a disagreement) are shown with the reason and are left out. The list stays on the left and the chosen version
 * opens on the right.
 */
@Component({
  selector: 'app-published-knowledge',
  templateUrl: './published-knowledge.component.html',
  styleUrls: ['./published-knowledge.component.scss'],
})
export class PublishedKnowledgeComponent implements OnInit {
  readonly nextId = NEXT;

  overview: KnowledgeVersionsOverview | null = null;
  loading = true;
  loadFailed = false;

  selectedId: string = NEXT;
  detail: KnowledgeVersionDetail | null = null;
  loadingDetail = false;
  publishing = false;
  restoring = false;
  reindexing = false;
  readonly expanded = new Set<string>();
  readonly note = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(500)] });

  constructor(
    private readonly service: PublishedKnowledgeService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get versions(): KnowledgeVersion[] {
    return this.overview?.versions ?? [];
  }

  /** The version published last, whether or not chat can read it yet. */
  get currentVersion(): KnowledgeVersion | null {
    return this.versions.find((v) => v.status === 'Current') ?? null;
  }

  /** The version chat reads now: the latest that went live, which is an older one while the newest has not (yet) finished. */
  get servingNumber(): number | null {
    return this.overview?.servingVersionNumber ?? null;
  }

  /** How a version stands for chat, in the tenant's words. */
  servingLabel(v: KnowledgeVersion): string {
    switch (v.servingStatus) {
      case 'Live':
        return 'Live for chat';
      case 'Indexing':
        return 'Getting ready for chat…';
      case 'Failed':
        return 'Not ready for chat';
      default:
        return 'Replaced';
    }
  }

  get canPublish(): boolean {
    const p = this.overview?.preview;
    return !!p && p.ready > 0 && !p.nothingNew && !this.publishing && this.note.valid;
  }

  /** Why the button is not available, or null when it is. */
  get cannotPublishBecause(): string | null {
    const p = this.overview?.preview;
    if (!p) {
      return null;
    }
    if (p.ready === 0) {
      return p.heldBack.length ? 'Everything you approved needs another look first.' : 'Approve some answers first.';
    }
    return p.nothingNew ? `Nothing has changed since version ${p.current?.number}.` : null;
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.service
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (o) => (this.overview = o),
        error: () => (this.loadFailed = true),
      });
  }

  select(id: string): void {
    this.selectedId = id;
    this.detail = null;
    if (id === NEXT) {
      return;
    }
    this.loadingDetail = true;
    this.service
      .getVersion(id)
      .pipe(finalize(() => (this.loadingDetail = false)))
      .subscribe({ next: (d) => (this.detail = d), error: () => undefined });
  }

  toggle(id: string): void {
    this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id);
  }

  publish(): void {
    if (!this.canPublish) {
      return;
    }
    this.publishing = true;
    this.service
      .publish(this.note.value.trim() || null)
      .pipe(finalize(() => (this.publishing = false)))
      .subscribe({
        next: (v) => {
          this.note.reset('');
          this.notify.success(`Version ${v.number} published.`);
          this.afterChange(v);
        },
        // ErrorInterceptor shows why (nothing approved, nothing changed).
        error: () => undefined,
      });
  }

  /** Saves the Draft file through the API without leaving the page. */
  downloadDraft(): void {
    this.service.draftFile().subscribe({ next: (blob) => this.save(blob, 'product-knowledge-draft.txt'), error: () => undefined });
  }

  downloadFinal(version: KnowledgeVersion): void {
    this.service.finalFile(version.id).subscribe({ next: (blob) => this.save(blob, `product-knowledge-v${version.number}.txt`), error: () => undefined });
  }

  private save(blob: Blob, fileName: string): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  restore(version: KnowledgeVersion): void {
    const data: ConfirmDialogData = {
      title: `Restore version ${version.number}?`,
      message: `A new version is published with exactly what version ${version.number} contained. Version ${this.overview?.preview.current?.number ?? ''} and everything in between stay in the record.`,
      confirmLabel: 'Restore',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.restoring = true;
        this.service
          .restore(version.id, null)
          .pipe(finalize(() => (this.restoring = false)))
          .subscribe({
            next: (v) => {
              this.notify.success(`Version ${v.number} published from version ${version.number}.`);
              this.afterChange(v);
            },
            error: () => undefined,
          });
      });
  }

  /** Tries again to prepare a published version for chat. Publishing is never undone by this failing; the version just stays "not ready for chat". */
  reindex(version: KnowledgeVersion): void {
    if (this.reindexing) {
      return;
    }
    this.reindexing = true;
    this.service
      .reindex(version.id)
      .pipe(finalize(() => (this.reindexing = false)))
      .subscribe({
        next: (v) => {
          v.servingStatus === 'Live' ? this.notify.success(`Version ${v.number} is live for chat.`) : this.notify.error(v.servingError ?? 'It could not be made ready for chat yet.');
          this.load();
          if (this.selectedId !== NEXT) {
            this.select(this.selectedId);
          }
        },
        // ErrorInterceptor shows why (already live, being prepared right now).
        error: () => undefined,
      });
  }

  private afterChange(created: KnowledgeVersion): void {
    this.load();
    this.select(created.id);
  }
}
