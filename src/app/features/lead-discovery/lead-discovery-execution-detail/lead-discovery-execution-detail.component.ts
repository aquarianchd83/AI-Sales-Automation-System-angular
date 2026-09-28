import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { finalize, map, takeUntil } from 'rxjs/operators';

import { formatCharge } from '../../../core/models/billing.model';
import { LeadDiscoveryExecutionDetail, leadDiscoveryStatusChipClass } from '../../../core/models/lead-discovery-history.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';

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

  readonly customerColumns = ['customerName', 'phone', 'status', 'error'];
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
    private readonly notify: NotificationService
  ) {}

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
