import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, map, takeUntil } from 'rxjs/operators';

import { formatCharge } from '../../../core/models/billing.model';
import {
  LeadDiscoveryExecutionCustomer,
  LeadDiscoveryExecutionDetail,
  VERIFICATION_FILTERS,
  consentSmsChipClass,
  consentSmsLabel,
  consentSmsWasSent,
  filterByVerification,
  leadDiscoveryStatusChipClass,
  rowHistoryEvents,
  verificationChipClass,
  verificationLabel,
} from '../../../core/models/lead-discovery-history.model';
import { LeadDiscoveryRun } from '../../../core/models/lead-discovery.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';
import { CandidatesConsideredDialogComponent, CandidatesConsideredDialogData } from '../candidates-considered-dialog/candidates-considered-dialog.component';
import { CustomerHistoryDialogComponent } from '../../../shared/components/customer-history-dialog/customer-history-dialog.component';
import { EntitlementsStore } from '../../../core/services/entitlements.store';
import { USED_UP_HINT } from '../../../core/models/wallet.model';

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
  readonly smsChip = consentSmsChipClass;
  readonly smsText = consentSmsLabel;
  readonly smsSent = consentSmsWasSent;
  /** The DND check filter on the Customers tab; 'All' shows every row. */
  verificationFilter = 'All';
  readonly verificationChip = verificationChipClass;
  readonly verificationText = verificationLabel;

  readonly customerColumns = ['customerName', 'crmCustomerName', 'phone', 'status', 'dnd', 'verifiedAt', 'consentSms', 'error', 'history'];
  readonly templateColumns = ['sequence', 'templateName', 'delay', 'status'];
  readonly lockColumns = ['transitionAtUtc', 'from', 'to', 'reason'];

  detail: LeadDiscoveryExecutionDetail | null = null;
  loading = true;
  failed = false;
  retrying = false;

  private executionId = '';
  private readonly destroy$ = new Subject<void>();

  private readonly featureAccess = inject(EntitlementsStore);
  readonly usedUpHint = USED_UP_HINT;

  /** Free leads used up: this execution stays readable, retrying it needs Premium. */
  get usedUp(): boolean {
    return this.featureAccess.usedUp('LeadDiscovery') !== null;
  }

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

  /** The bold lead-in of a consent SMS note, when it names a missing setting; empty when the note has none. Separate strings, not one object, so
   * the template compares them by value on every check. */
  smsHead(row: LeadDiscoveryExecutionCustomer): string {
    const head = row.consentSmsHeadline ?? '';
    return head && (row.consentSmsNote ?? '').startsWith(head) ? head : '';
  }

  /** The rest of the note after its bold lead-in: what to do about it. A row with no note still says it was not sent. */
  smsRest(row: LeadDiscoveryExecutionCustomer): string {
    return (row.consentSmsNote || 'Not sent').slice(this.smsHead(row).length);
  }

  /** The credits this execution took from the wallet; zero for a response that does not say. */
  credits(d: LeadDiscoveryExecutionDetail): number {
    return d.creditsCharged ?? 0;
  }

  /** Candidates the run considered that qualified but were not needed because the batch was already full - what the "considered" figure
   * has beyond saved, duplicate and rejected. */
  notNeeded(r: LeadDiscoveryRun): number {
    return Math.max(0, r.candidatesConsidered - r.leadsSaved - r.duplicates - r.rejected);
  }

  /** The outcomes each tile at the top opens. They are the rows each tile counts: Skipped is a row that was not saved but not rejected
   * (not needed, or created by an earlier execution); Invalid is a row that was not saved as a customer (rejected, or kept only as a lead). */
  readonly allOutcomes: string[] = [];
  readonly createdOutcomes = ['Saved'];
  readonly skippedOutcomes = ['Not needed', 'Skipped'];
  readonly invalidOutcomes = ['Rejected', 'Lead only'];
  readonly failedOutcomes = ['Failed'];

  /** The outcomes each figure on the "Candidates" line opens. "Saved" is the run's own figure: customers created plus leads kept without one. */
  readonly savedOutcomes = ['Saved', 'Lead only'];
  readonly duplicateOutcomes = ['Duplicate'];
  readonly rejectedOutcomes = ['Rejected'];
  readonly notNeededOutcomes = ['Not needed'];

  /** Opens the list of the candidates this run considered, with what became of each - built from the rows already loaded. With no
   * filter every candidate is listed; a figure on the page passes the outcomes behind it. */
  showCandidates(d: LeadDiscoveryExecutionDetail, filter: string[] = []): void {
    const data: CandidatesConsideredDialogData = { considered: d.research?.candidatesConsidered ?? d.customers.length, rows: d.customers, filter };
    this.dialog.open(CandidatesConsideredDialogComponent, { data, width: '860px', maxWidth: '95vw' });
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
