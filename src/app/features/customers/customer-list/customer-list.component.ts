import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { SelectionModel } from '@angular/cdk/collections';
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
import { Customer, OptInStatus, customerDisplayName } from '../../../core/models/customer.model';
import { CustomerFormDialogComponent, CustomerFormDialogData } from '../customer-form-dialog/customer-form-dialog.component';
import { CustomerImportDialogComponent } from '../customer-import-dialog/customer-import-dialog.component';
import { CustomerOptInDialogComponent } from '../customer-opt-in-dialog/customer-opt-in-dialog.component';
import { CustomerService } from '../../../core/services/customer.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-customer-list',
  templateUrl: './customer-list.component.html',
  styleUrls: ['./customer-list.component.scss'],
})
export class CustomerListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = [
    'select',
    'name',
    'phoneNumberE164',
    'email',
    'optInStatus',
    'tags',
    'createdAt',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly displayName = customerDisplayName;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  /**
   * Scoped to the current page on purpose. The API pages server-side and offers no
   * "select everything matching this search", so a selection that survived paging
   * would let someone delete rows they never saw.
   */
  readonly selection = new SelectionModel<Customer>(true, []);

  page: PagedResult<Customer> = emptyPage<Customer>();
  loading = true;
  bulkDeleting = false;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly customers: CustomerService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
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
          return this.customers.getPaged(this.query).pipe(
            // Caught inside the projection so a failed request does not complete the
            // outer stream — otherwise one API error would kill paging and search
            // for the rest of the page's life.
            catchError(() => of(emptyPage<Customer>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => {
        this.page = page;
        // Rows are new object references after every fetch, so a stale selection
        // could never match them anyway — clear it rather than leave it dangling.
        this.selection.clear();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = {
      ...this.query,
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    };
    this.reload$.next();
  }

  // ---- selection ----------------------------------------------------------

  get allOnPageSelected(): boolean {
    return this.page.items.length > 0 && this.selection.selected.length === this.page.items.length;
  }

  get someOnPageSelected(): boolean {
    return this.selection.hasValue() && !this.allOnPageSelected;
  }

  toggleAllOnPage(): void {
    if (this.allOnPageSelected) {
      this.selection.clear();
    } else {
      this.selection.select(...this.page.items);
    }
  }

  create(): void {
    this.openForm({ mode: 'create' });
  }

  edit(customer: Customer, event?: Event): void {
    event?.stopPropagation();
    this.openForm({ mode: 'edit', customer });
  }

  view(customer: Customer): void {
    void this.router.navigate([customer.id], { relativeTo: this.route });
  }

  isOptedOut(customer: Customer): boolean {
    return customer.optInStatus === OptInStatus.OptedOut;
  }

  isOptedIn(customer: Customer): boolean {
    return customer.optInStatus === OptInStatus.OptedIn;
  }

  optIn(customer: Customer, event: Event): void {
    event.stopPropagation();
    this.dialog
      .open(CustomerOptInDialogComponent, {
        data: { customer },
        width: '480px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.reload$.next();
        }
      });
  }

  optOut(customer: Customer, event: Event): void {
    event.stopPropagation();
    const data: ConfirmDialogData = {
      title: 'Opt this customer out?',
      message: `${customerDisplayName(customer)} will be excluded from all future automated messaging. This is a compliance action and is logged.`,
      confirmLabel: 'Opt out',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.customers.optOut(customer.id).subscribe(() => {
          this.notify.success('Customer opted out.');
          this.reload$.next();
        });
      });
  }

  delete(customer: Customer, event: Event): void {
    event.stopPropagation();
    const data: ConfirmDialogData = {
      title: 'Delete this customer?',
      message: `${customerDisplayName(customer)} will be removed from the list. The backend soft-deletes the record, so message history is preserved.`,
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
        this.customers.delete(customer.id).subscribe(() => {
          this.notify.success('Customer deleted.');
          this.reload$.next();
        });
      });
  }

  /** Soft-deletes every selected customer in a single request. */
  deleteSelected(): void {
    const selected = this.selection.selected;
    if (!selected.length || this.bulkDeleting) {
      return;
    }

    const names = selected.slice(0, 3).map(customerDisplayName).join(', ');
    const rest = selected.length - 3;
    const data: ConfirmDialogData = {
      title: `Delete ${selected.length} customer${selected.length === 1 ? '' : 's'}?`,
      message:
        `${names}${rest > 0 ? ` and ${rest} more` : ''} will be removed from the list. ` +
        'The backend soft-deletes these records, so message history is preserved.',
      confirmLabel: `Delete ${selected.length}`,
      destructive: true,
    };

    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }

        this.bulkDeleting = true;
        this.customers
          .bulkDelete(selected.map((customer) => customer.id))
          .pipe(finalize(() => (this.bulkDeleting = false)))
          .subscribe({
            next: (result) => {
              // deletedCount can trail requestedCount when a row was already deleted
              // in another tab — report what actually happened rather than assume.
              const missed = result.requestedCount - result.deletedCount;
              if (missed > 0) {
                this.notify.info(
                  `Deleted ${result.deletedCount} of ${result.requestedCount}. ` +
                    `${missed} had already been deleted.`
                );
              } else {
                this.notify.success(
                  `Deleted ${result.deletedCount} customer${result.deletedCount === 1 ? '' : 's'}.`
                );
              }
              this.reload$.next();
            },
            error: () => {
              // ErrorInterceptor toasts it; keep the selection so it can be retried.
            },
          });
      });
  }

  importCsv(): void {
    this.dialog
      .open(CustomerImportDialogComponent, { width: '620px', disableClose: true })
      .afterClosed()
      .subscribe((imported) => {
        if (imported) {
          this.reload$.next();
        }
      });
  }

  statusClass(status: string): string {
    switch (status) {
      case OptInStatus.OptedIn:
        return 'status-chip status-chip--opted-in';
      case OptInStatus.OptedOut:
        return 'status-chip status-chip--opted-out';
      default:
        return 'status-chip status-chip--pending';
    }
  }

  private openForm(data: CustomerFormDialogData): void {
    this.dialog
      .open(CustomerFormDialogComponent, { data, width: '640px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload$.next();
        }
      });
  }
}
