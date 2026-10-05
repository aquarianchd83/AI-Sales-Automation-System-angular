import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, forkJoin, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PackageFormDialogComponent, PackageFormDialogData } from '../package-form-dialog/package-form-dialog.component';
import { PackageService } from '../../../core/services/package.service';
import { PackageSummary, SalesPackage, formatPackageDuration } from '../../../core/models/package.model';
import { TenantSettingsService } from '../../../core/services/tenant-settings.service';

@Component({
  selector: 'app-package-list',
  templateUrl: './package-list.component.html',
  styleUrls: ['./package-list.component.scss'],
})
export class PackageListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['name', 'price', 'duration', 'features', 'expectedSales', 'projectedRevenue', 'status', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly formatDuration = formatPackageDuration;

  page: PagedResult<SalesPackage> = emptyPage<SalesPackage>();
  summary: PackageSummary = { activePackages: 0, totalExpectedSales: 0, totalProjectedRevenue: 0 };
  /** The tenant's own currency symbol; empty until (or unless) the charges call answers, in which case amounts show bare. */
  currencySymbol = '';
  loading = true;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly packages: PackageService,
    private readonly tenantSettings: TenantSettingsService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.tenantSettings
      .getCharges()
      .pipe(
        map((charges) => charges.currencySymbol),
        catchError(() => of('')),
        takeUntil(this.destroy$)
      )
      .subscribe((symbol) => (this.currencySymbol = symbol));

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
          return forkJoin({
            page: this.packages.getPaged(this.query).pipe(catchError(() => of(emptyPage<SalesPackage>(this.query.pageSize)))),
            summary: this.packages.getSummary().pipe(catchError(() => of(this.summary))),
          }).pipe(finalize(() => (this.loading = false)));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(({ page, summary }) => {
        this.page = page;
        this.summary = summary;
      });
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
    this.openForm({ mode: 'create', currencySymbol: this.currencySymbol });
  }

  edit(pkg: SalesPackage): void {
    this.openForm({ mode: 'edit', package: pkg, currencySymbol: this.currencySymbol });
  }

  delete(pkg: SalesPackage): void {
    const data: ConfirmDialogData = {
      title: `Delete "${pkg.name}"?`,
      message: 'This removes the package and its share of your revenue estimate. Customers are not affected.',
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
        this.packages.delete(pkg.id).subscribe(() => {
          this.notify.success('Package deleted.');
          this.reload$.next();
        });
      });
  }

  private openForm(data: PackageFormDialogData): void {
    this.dialog
      .open(PackageFormDialogComponent, { data, width: '560px', maxWidth: '95vw', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload$.next();
        }
      });
  }
}
