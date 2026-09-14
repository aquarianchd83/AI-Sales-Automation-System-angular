import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
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

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { PlatformAuditLogEntry, PlatformAuditLogQuery } from '../../../core/models/platform.model';
import { PlatformAuditLogService } from '../../../core/services/platform-audit-log.service';

@Component({
  selector: 'app-platform-audit-log',
  templateUrl: './platform-audit-log.component.html',
  styleUrls: ['./platform-audit-log.component.scss'],
})
export class PlatformAuditLogComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['createdAt', 'actor', 'action', 'target', 'details'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<PlatformAuditLogEntry> = emptyPage<PlatformAuditLogEntry>();
  loading = true;

  private query: PlatformAuditLogQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly auditLog: PlatformAuditLogService) {}

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
          return this.auditLog.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<PlatformAuditLogEntry>(this.query.pageSize))),
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
}
