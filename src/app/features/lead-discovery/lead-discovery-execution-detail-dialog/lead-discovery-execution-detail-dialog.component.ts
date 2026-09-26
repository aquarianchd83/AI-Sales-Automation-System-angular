import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { LeadDiscoveryExecutionDetail, leadDiscoveryStatusChipClass } from '../../../core/models/lead-discovery-history.model';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface LeadDiscoveryExecutionDetailDialogData {
  executionId: string;
}

/** Everything recorded about one lead discovery execution: per-customer results, template
 * associations, and every lock-state transition, plus a retry action when the execution allows it. */
@Component({
  selector: 'app-lead-discovery-execution-detail-dialog',
  templateUrl: './lead-discovery-execution-detail-dialog.component.html',
  styleUrls: ['./lead-discovery-execution-detail-dialog.component.scss'],
})
export class LeadDiscoveryExecutionDetailDialogComponent implements OnInit {
  readonly chipClass = leadDiscoveryStatusChipClass;

  detail: LeadDiscoveryExecutionDetail | null = null;
  loading = true;
  failed = false;
  retrying = false;

  readonly customerColumns = ['customerName', 'phone', 'status', 'error'];
  readonly templateColumns = ['sequence', 'templateName', 'delay', 'status'];
  readonly lockColumns = ['transitionAtUtc', 'from', 'to', 'reason'];

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: LeadDiscoveryExecutionDetailDialogData,
    private readonly leadDiscovery: LeadDiscoveryService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<LeadDiscoveryExecutionDetailDialogComponent>
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.leadDiscovery
      .getExecution(this.data.executionId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (detail) => (this.detail = detail),
        error: () => (this.failed = true),
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
          this.dialogRef.close(true);
        },
        error: (err) => {
          const message = err?.error?.message || err?.error?.detail || 'This execution could not be retried.';
          this.notify.error(message);
        },
      });
  }
}
