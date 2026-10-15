import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, map, takeUntil } from 'rxjs/operators';

import { formatCharge } from '../../../core/models/billing.model';
import {
  LeadDiscoveryExecutionCustomer,
  LeadDiscoveryExecutionDetail,
  VERIFICATION_FILTERS,
  filterByVerification,
  leadDiscoveryStatusChipClass,
  rowHistoryEvents,
  verificationChipClass,
  verificationLabel,
} from '../../../core/models/lead-discovery-history.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CustomerHistoryDialogComponent } from '../../../shared/components/customer-history-dialog/customer-history-dialog.component';

/** One lead discovery execution in full: customer outcome counts, per-customer results, template
 * associations and lock transitions, plus a retry action when the execution allows it. Admin only. */
@Component({
  selector: 'app-lead-discovery-execution-detail',
  templateUrl: './lead-discovery-execution-detail.component.html',
  styleUrls: ['./lead-discovery-execution-detail.component.scss'],
})
export class LeadDiscoveryExecutionDetailComponent implements OnInit, OnDestroy {
  readonly chipClass = leadDiscoveryStatusChipClass;
  readonly formatCharge = formatCharge;
  readonly verificationFilters = VERIFICATION_FILTERS;
  /** The DND check filter on the Customers tab; 'All' shows every row. */
  verificationFilter = 'All';
  readonly verificationChip = verificationChipClass;
  readonly verificationText = verificationLabel;

  readonly customerColumns = ['customerName', 'crmCustomerName', 'phone', 'status', 'dnd', 'verifiedAt', 'error', 'history'];
  readonly templateColumns = ['sequence', 'templateName', 'delay', 'status'];
  readonly lockColumns = ['transitionAtUtc', 'from', 'to', 'reason'];

  detail: LeadDiscoveryExecutionDetail | null = null;
  loading = true;
  failed = false;
  retrying = false;

  private executionId = '';
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly leadDiscovery: LeadDiscoveryService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  /** True when the DND check ran for any number in this execution - the counts and the filter are only worth showing then. */
  dndChecked(d: LeadDiscoveryExecutionDetail): boolean {
    const c = d.verificationCounts;
    return !!c && c.passed + c.failed + c.pending + c.error > 0;
  }

  /** The Customers tab rows after the DND check filter. */
  shown(d: LeadDiscoveryExecutionDetail): LeadDiscoveryExecutionCustomer[] {
    return filterByVerification(d.customers, this.verificationFilter);
  }

  /** The history of one row: the customer's own, or - for a business that never became a customer (rejected by the DND check,
   * closed, no usable number) - what this execution recorded about it. */
  showCustomerHistory(row: LeadDiscoveryExecutionCustomer): void {
    const displayName = row.crmCustomerName || row.customerName;
    const data = row.customerId ? { customerId: row.customerId, displayName } : { displayName, events: rowHistoryEvents(row) };
    this.dialog.open(CustomerHistoryDialogComponent, { data, width: '560px' });
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id') ?? ''),
        takeUntil(this.destroy$)
      )
      .subscribe((id) => {
        this.executionId = id;
        this.load();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.leadDiscovery
      .getExecution(this.executionId)
      .pipe(
        finalize(() => (this.loading = false)),
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: (detail) => (this.detail = detail),
        error: () => {
          this.detail = null;
          this.failed = true;
        },
      });
  }

  retry(): void {
    if (!this.detail || this.retrying) {
      return;
    }
    this.retrying = true;
    this.leadDiscovery
      .retryExecution(this.detail.execution.id)
      .pipe(finalize(() => (this.retrying = false)))
      .subscribe({
        next: () => {
          this.notify.success('Retry queued — it will run as a new execution.');
          this.router.navigate(['..'], { relativeTo: this.route });
        },
        error: (err) => {
          const message = err?.error?.message || err?.error?.detail || 'This execution could not be retried.';
          this.notify.error(message);
        },
      });
  }
}
