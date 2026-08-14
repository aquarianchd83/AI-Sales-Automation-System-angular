import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
import { NotificationService } from '../../../core/services/notification.service';
import { Tag } from '../../../core/models/tag.model';
import { TagFormDialogComponent, TagFormDialogData } from '../tag-form-dialog/tag-form-dialog.component';
import { TagService } from '../../../core/services/tag.service';

@Component({
  selector: 'app-tag-list',
  templateUrl: './tag-list.component.html',
  styleUrls: ['./tag-list.component.scss'],
})
export class TagListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['name', 'customerCount', 'createdAt', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<Tag> = emptyPage<Tag>();
  loading = true;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly tags: TagService,
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
          return this.tags.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<Tag>(this.query.pageSize))),
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

  create(): void {
    this.openForm({ mode: 'create' });
  }

  edit(tag: Tag): void {
    this.openForm({ mode: 'edit', tag });
  }

  delete(tag: Tag): void {
    const inUse = tag.customerCount > 0;
    const data: ConfirmDialogData = inUse
      ? {
          title: `Delete "${tag.name}"?`,
          message:
            `This tag is applied to ${tag.customerCount} customer${tag.customerCount === 1 ? '' : 's'}. ` +
            'Deleting it removes it from all of them — it does not delete the customers themselves.',
          confirmLabel: 'Delete anyway',
          destructive: true,
        }
      : {
          title: `Delete "${tag.name}"?`,
          message: 'This tag is not applied to any customer.',
          confirmLabel: 'Delete',
          destructive: true,
        };

    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        // Force only when we already know it's in use — otherwise a plain delete is
        // enough, and if another admin applied it in the meantime the API's 409 (with
        // the real count) surfaces via ErrorInterceptor rather than silently forcing.
        this.tags.delete(tag.id, inUse).subscribe(() => {
          this.notify.success('Tag deleted.');
          this.reload$.next();
        });
      });
  }

  private openForm(data: TagFormDialogData): void {
    this.dialog
      .open(TagFormDialogComponent, { data, width: '440px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload$.next();
        }
      });
  }
}
