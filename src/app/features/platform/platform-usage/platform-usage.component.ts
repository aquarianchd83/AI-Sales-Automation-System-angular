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

import { formatCharge } from '../../../core/models/billing.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { PlatformTenantUsage } from '../../../core/models/platform.model';
import { PlatformUsageService } from '../../../core/services/platform-usage.service';

@Component({
  selector: 'app-platform-usage',
  templateUrl: './platform-usage.component.html',
  styleUrls: ['./platform-usage.component.scss'],
})
export class PlatformUsageComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['tenant', 'messages', 'users', 'ai', 'whatsAppSpend', 'discovery', 'total'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  /** Every money column here is USD — these are the platform's own costs to serve a tenant, not what
   * that tenant is quoted in its own currency (that conversion belongs on the tenant's own screens). */
  readonly formatCharge = formatCharge;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<PlatformTenantUsage> = emptyPage<PlatformTenantUsage>();
  loading = true;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly usage: PlatformUsageService) {}

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
          return this.usage.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<PlatformTenantUsage>(this.query.pageSize))),
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
