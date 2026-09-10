import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Observable, Subject, of } from 'rxjs';
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
import {
  PlatformTenantListItem,
  PlatformTenantQuery,
  TENANT_STATUS_LABELS,
  TenantStatus,
} from '../../../core/models/platform.model';
import { ImpersonationSessionService } from '../../../core/services/impersonation-session.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlatformTenantFormDialogComponent } from '../platform-tenant-form-dialog/platform-tenant-form-dialog.component';

@Component({
  selector: 'app-platform-tenant-list',
  templateUrl: './platform-tenant-list.component.html',
  styleUrls: ['./platform-tenant-list.component.scss'],
})
export class PlatformTenantListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['name', 'status', 'plan', 'userCount', 'createdAt', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly statusControl = new FormControl<TenantStatus | null>(null);
  readonly statusOptions = Object.values(TenantStatus).filter(
    (v): v is TenantStatus => typeof v === 'number'
  );
  readonly statusLabels = TENANT_STATUS_LABELS;
  readonly TenantStatus = TenantStatus;

  page: PagedResult<PlatformTenantListItem> = emptyPage<PlatformTenantListItem>();
  loading = true;
  impersonatingId: string | null = null;

  private query: PlatformTenantQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly tenants: PlatformTenantService,
    private readonly impersonation: ImpersonationSessionService,
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

    this.statusControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((status) => {
      this.query = { ...this.query, page: 1, status: status ?? undefined };
      this.paginator?.firstPage();
      this.reload$.next();
    });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.tenants.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<PlatformTenantListItem>(this.query.pageSize))),
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
    this.dialog
      .open(PlatformTenantFormDialogComponent, { width: '520px', disableClose: true })
      .afterClosed()
      .subscribe((created) => {
        if (created) {
          this.reload$.next();
        }
      });
  }

  /** A method, not a template-level `statusLabels[tenant.status]` index — Angular's strict
   * template checker infers `mat-table` row bindings as `any`, and TS7053 refuses to index an
   * enum-keyed Record with an `any` key. An explicitly-typed parameter here sidesteps that. */
  statusLabel(status: TenantStatus): string {
    return this.statusLabels[status];
  }

  suspend(tenant: PlatformTenantListItem): void {
    this.confirmAndRun(
      {
        title: 'Suspend this tenant?',
        message: `${tenant.name} and all its users will be locked out immediately. Their data is untouched, and this is reversible.`,
        confirmLabel: 'Suspend',
        destructive: true,
      },
      () => this.tenants.suspend(tenant.id),
      'Tenant suspended.'
    );
  }

  reactivate(tenant: PlatformTenantListItem): void {
    this.confirmAndRun(
      {
        title: 'Reactivate this tenant?',
        message: `${tenant.name} will regain access immediately.`,
        confirmLabel: 'Reactivate',
      },
      () => this.tenants.reactivate(tenant.id),
      'Tenant reactivated.'
    );
  }

  delete(tenant: PlatformTenantListItem): void {
    this.confirmAndRun(
      {
        title: 'Delete this tenant?',
        message: `${tenant.name} will be locked out permanently. This never deletes their underlying data — it's a terminal status a PlatformSuperAdmin can still reverse from here if needed.`,
        confirmLabel: 'Delete',
        destructive: true,
      },
      () => this.tenants.delete(tenant.id),
      'Tenant deleted.'
    );
  }

  impersonate(tenant: PlatformTenantListItem): void {
    if (this.impersonatingId) {
      return;
    }
    this.impersonatingId = tenant.id;
    // Opened synchronously, before the HTTP call — see ImpersonationSessionService's own doc
    // comment for why this can't wait until the response comes back.
    const placeholder = this.impersonation.openPlaceholder();
    this.tenants
      .impersonate(tenant.id)
      .pipe(finalize(() => (this.impersonatingId = null)))
      .subscribe((session) => {
        if (this.impersonation.send(placeholder, session)) {
          this.notify.info(`Opened a support session as ${session.impersonatedUserEmail} in a new tab.`);
        } else {
          this.notify.error('Your browser blocked the new tab. Allow popups for this site and try again.');
        }
      });
  }

  private confirmAndRun(data: ConfirmDialogData, action: () => Observable<void>, successMessage: string): void {
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        action().subscribe(() => {
          this.notify.success(successMessage);
          this.reload$.next();
        });
      });
  }
}
