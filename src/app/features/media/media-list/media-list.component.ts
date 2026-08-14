import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { MediaAsset, formatFileSize, isImageContentType } from '../../../core/models/media.model';
import { MediaService } from '../../../core/services/media.service';
import { MediaUploadDialogComponent } from '../media-upload-dialog/media-upload-dialog.component';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-media-list',
  templateUrl: './media-list.component.html',
  styleUrls: ['./media-list.component.scss'],
})
export class MediaListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly isImage = isImageContentType;
  readonly formatSize = formatFileSize;

  page: PagedResult<MediaAsset> = emptyPage<MediaAsset>();
  loading = true;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly media: MediaService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.query = { ...this.query, page: 1, search: search || undefined };
        this.paginator?.firstPage();
        this.reload$.next();
      });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.media.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<MediaAsset>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  upload(): void {
    this.dialog
      .open(MediaUploadDialogComponent, { width: '520px', disableClose: true })
      .afterClosed()
      .subscribe((uploaded) => {
        if (uploaded) {
          this.reload$.next();
        }
      });
  }

  delete(asset: MediaAsset): void {
    const data: ConfirmDialogData = {
      title: `Delete "${asset.fileName}"?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.media.delete(asset.id).subscribe({
          next: () => {
            this.notify.success('File deleted.');
            this.reload$.next();
          },
          error: (error: unknown) => {
            // MediaAssetDto carries no "attached to N steps" count the way TagDto does, so
            // the plain attempt is the only way to discover it's in use — 409 means it is.
            if (error instanceof HttpErrorResponse && error.status === 409) {
              this.confirmForceDelete(asset);
            }
          },
        });
      });
  }

  private confirmForceDelete(asset: MediaAsset): void {
    const data: ConfirmDialogData = {
      title: 'This file is in use',
      message: `"${asset.fileName}" is attached to one or more campaign steps. Deleting it removes it from those steps too.`,
      confirmLabel: 'Delete anyway',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.media.delete(asset.id, true).subscribe(() => {
          this.notify.success('File deleted.');
          this.reload$.next();
        });
      });
  }
}
