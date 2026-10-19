import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, timer } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  KnowledgeSource,
  KnowledgeSourceDetail,
  KnowledgeSourcePage,
  KnowledgeSourcesOverview,
  KnowledgeSourceStatus,
} from '../../../core/models/product-knowledge.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ProductKnowledgeService } from '../../../core/services/product-knowledge.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

/** How often the list refreshes while a source is still being read. */
export const POLL_MS = 4000;

const STATUS_TEXT: Record<KnowledgeSourceStatus, string> = {
  Queued: 'Waiting to be read',
  Processing: 'Reading…',
  Ready: 'Read',
  Failed: 'Could not be read',
};

/**
 * Where a tenant gives the product-knowledge engine what to read: upload brochures, PDFs, manuals and price lists, and add the website.
 * Each source shows how it was read - page by page, with what was found and what failed and why - and can be retried, scanned again,
 * downloaded or removed. The list stays on the left and the chosen source opens on the right, so the tenant never leaves the page. Files are
 * kept privately in the platform's storage, in the tenant's own folder.
 */
@Component({
  selector: 'app-knowledge-sources',
  templateUrl: './knowledge-sources.component.html',
  styleUrls: ['./knowledge-sources.component.scss'],
})
export class KnowledgeSourcesComponent implements OnInit, OnDestroy {
  readonly statusText = STATUS_TEXT;

  overview: KnowledgeSourcesOverview | null = null;
  loading = true;
  loadFailed = false;

  selectedId: string | null = null;
  detail: KnowledgeSourceDetail | null = null;
  detailLoading = false;

  /** Files being uploaded right now, by name. */
  uploading: string[] = [];
  dragOver = false;
  readonly website = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(2000)] });
  addingWebsite = false;
  busy: Record<string, boolean> = {};

  private poll: Subscription | null = null;

  constructor(
    private readonly sources: ProductKnowledgeService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.poll?.unsubscribe();
  }

  get list(): KnowledgeSource[] {
    return this.overview?.sources ?? [];
  }

  get selected(): KnowledgeSource | null {
    return this.list.find((s) => s.id === this.selectedId) ?? null;
  }

  get accept(): string {
    return (this.overview?.supportedExtensions ?? []).join(',');
  }

  get atLimit(): boolean {
    return !!this.overview && this.list.length >= this.overview.maxSources;
  }

  get canAdd(): boolean {
    return !!this.overview && this.overview.storageReady && !this.atLimit;
  }

  /** "PDF, DOCX, TXT…" for the upload hint. */
  get formats(): string {
    return (this.overview?.supportedExtensions ?? []).map((e) => e.replace('.', '').toUpperCase()).join(', ');
  }

  isWorking(source: KnowledgeSource): boolean {
    return source.status === 'Queued' || source.status === 'Processing';
  }

  statusClass(status: string): string {
    return `chip chip--${status.toLowerCase()}`;
  }

  icon(source: KnowledgeSource): string {
    if (source.kind === 'Website') {
      return 'language';
    }
    const name = (source.fileName ?? source.name).toLowerCase();
    return name.endsWith('.pdf') ? 'picture_as_pdf' : /\.(png|jpe?g)$/.test(name) ? 'image' : 'description';
  }

  size(bytes: number | null): string {
    if (bytes === null) {
      return '';
    }
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  /** "Page 3", or the page address for a website passage. */
  placeOf(passage: { pageNumber: number | null; url: string | null }): string {
    if (passage.url) {
      try {
        const url = new URL(passage.url);
        return url.pathname === '/' ? url.host : url.pathname;
      } catch {
        return passage.url;
      }
    }
    return passage.pageNumber !== null ? `Page ${passage.pageNumber}` : 'Document';
  }

  pageCount(status: KnowledgeSourcePage['status']): number {
    return this.detail?.pages.filter((p) => p.status === status).length ?? 0;
  }

  // ----- loading -------------------------------------------------------------------------------------------------------------------

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.sources
      .list()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (overview) => this.apply(overview),
        error: () => (this.loadFailed = true),
      });
  }

  select(source: KnowledgeSource): void {
    this.selectedId = source.id;
    this.loadDetail();
  }

  private loadDetail(quiet = false): void {
    const id = this.selectedId;
    if (!id) {
      this.detail = null;
      return;
    }
    if (!quiet) {
      this.detailLoading = true;
      this.detail = null;
    }
    this.sources
      .get(id)
      .pipe(finalize(() => (this.detailLoading = false)))
      .subscribe({
        next: (detail) => {
          if (this.selectedId === id) {
            this.detail = detail;
          }
        },
      });
  }

  private apply(overview: KnowledgeSourcesOverview): void {
    const before = this.selected;
    this.overview = overview;
    if (!this.selected && overview.sources.length) {
      this.select(overview.sources[0]);
    } else if (this.selected && before && (before.status !== this.selected.status || before.version !== this.selected.version)) {
      // The chosen source finished reading meanwhile: show what was read.
      this.loadDetail(true);
    } else if (!this.selected) {
      this.selectedId = null;
      this.detail = null;
    }
    this.schedulePoll();
  }

  /** While anything is still being read, refresh every few seconds; stop as soon as nothing is. */
  private schedulePoll(): void {
    this.poll?.unsubscribe();
    this.poll = null;
    if (this.list.some((s) => this.isWorking(s))) {
      this.poll = timer(POLL_MS).subscribe(() => this.sources.list().subscribe({ next: (overview) => this.apply(overview) }));
    }
  }

  // ----- adding sources ------------------------------------------------------------------------------------------------------------

  onFiles(files: FileList | File[] | null): void {
    const list = Array.from(files ?? []);
    if (!list.length || !this.canAdd) {
      return;
    }
    const maxBytes = (this.overview?.maxFileMb ?? 0) * 1024 * 1024;
    for (const file of list) {
      if (maxBytes && file.size > maxBytes) {
        this.notify.error(`${file.name} is larger than ${this.overview?.maxFileMb} MB.`);
        continue;
      }
      this.uploading = [...this.uploading, file.name];
      this.sources
        .upload(file)
        .pipe(finalize(() => (this.uploading = this.uploading.filter((n) => n !== file.name))))
        .subscribe({
          next: (source) => {
            this.notify.success(`${file.name} uploaded. It is being read now.`);
            this.insert(source);
          },
          // ErrorInterceptor shows the reason (wrong type, too big, already uploaded).
          error: () => undefined,
        });
    }
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = false;
    this.onFiles(event.dataTransfer?.files ?? null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver = true;
  }

  addWebsite(): void {
    const url = this.website.value.trim();
    if (!url || this.addingWebsite || !this.canAdd) {
      this.website.markAsTouched();
      return;
    }
    this.addingWebsite = true;
    this.sources
      .addWebsite(url)
      .pipe(finalize(() => (this.addingWebsite = false)))
      .subscribe({
        next: (source) => {
          this.website.reset('');
          this.notify.success(`${source.name} added. Its pages are being read now.`);
          this.insert(source);
        },
        error: () => undefined,
      });
  }

  private insert(source: KnowledgeSource): void {
    if (!this.overview) {
      return;
    }
    this.overview = { ...this.overview, sources: [source, ...this.overview.sources.filter((s) => s.id !== source.id)] };
    this.select(source);
    this.schedulePoll();
  }

  // ----- actions -------------------------------------------------------------------------------------------------------------------

  retry(source: KnowledgeSource): void {
    if (this.busy[source.id]) {
      return;
    }
    this.busy = { ...this.busy, [source.id]: true };
    this.sources
      .retry(source.id)
      .pipe(finalize(() => (this.busy = { ...this.busy, [source.id]: false })))
      .subscribe({
        next: (updated) => {
          this.notify.info(source.canRescan ? `Scanning ${source.name} again.` : `Reading ${source.name} again.`);
          this.replace(updated);
          this.loadDetail(true);
        },
        error: () => undefined,
      });
  }

  remove(source: KnowledgeSource): void {
    const data: ConfirmDialogData = {
      title: `Remove ${source.name}?`,
      message: 'Its file and the text read from it are deleted. Answers built from it will need another source.',
      confirmLabel: 'Remove',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed || !this.overview) {
          return;
        }
        this.sources.remove(source.id).subscribe({
          next: () => {
            this.notify.success(`${source.name} removed.`);
            if (this.overview) {
              this.overview = { ...this.overview, sources: this.overview.sources.filter((s) => s.id !== source.id) };
            }
            if (this.selectedId === source.id) {
              this.selectedId = null;
              this.detail = null;
              if (this.list.length) {
                this.select(this.list[0]);
              }
            }
          },
          error: () => undefined,
        });
      });
  }

  /** Saves the file through the API (never a storage link) without leaving the page. */
  download(source: KnowledgeSource, which: 'original' | 'text'): void {
    this.sources.download(source.id, which).subscribe({
      next: (blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const base = (source.fileName ?? source.name).replace(/\.[^.]+$/, '');
        link.download = which === 'text' ? `${base}-extracted-v${source.version}.txt` : source.fileName ?? source.name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
      },
      error: () => undefined,
    });
  }

  private replace(source: KnowledgeSource): void {
    if (this.overview) {
      this.overview = { ...this.overview, sources: this.overview.sources.map((s) => (s.id === source.id ? source : s)) };
    }
    this.schedulePoll();
  }
}
