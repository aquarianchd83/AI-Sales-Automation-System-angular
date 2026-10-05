import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  ApplicationExecution,
  ApplicationSetup,
  SETUP_AUDIT_LABELS,
  SetupAuditAction,
  SetupAuditEntry,
  needsSetup,
} from '../../../core/models/application-setup.model';
import { PagedResult } from '../../../core/models/paged-result.model';
import { ApplicationService } from '../../../core/services/application.service';
import { CurrencySymbolService } from '../../../core/services/currency-symbol.service';
import { NotificationService } from '../../../core/services/notification.service';
import { displayAnswer } from '../../../core/utils/setup-rules';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ChangePlanDialogComponent, ChangePlanDialogData } from '../change-plan-dialog/change-plan-dialog.component';

interface SummarySection {
  title: string;
  rows: { label: string; value: string }[];
}

/** An application at a glance: where its setup stands, what the plan promises, a clear way to run it - and the history behind both. */
@Component({
  selector: 'app-application-detail',
  templateUrl: './application-detail.component.html',
  styleUrls: ['./application-detail.component.scss'],
})
export class ApplicationDetailComponent implements OnInit {
  setup: ApplicationSetup | null = null;
  summary: SummarySection[] = [];
  currencySymbol = '';
  loading = true;
  running = false;
  migrating = false;

  /** Set when a run was refused: what is still outstanding, straight from the API. */
  blockedMissing: string[] | null = null;

  audit: PagedResult<SetupAuditEntry> | null = null;
  executions: ApplicationExecution[] = [];
  readonly auditColumns = ['when', 'who', 'action', 'change', 'version'];
  readonly runColumns = ['when', 'version', 'fields'];

  private id = '';
  private historyLoaded = false;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly service: ApplicationService,
    private readonly currency: CurrencySymbolService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.currency.get().subscribe((symbol) => {
      this.currencySymbol = symbol;
      this.buildSummary();
    });
    this.load();
  }

  get needsSetup(): boolean {
    return this.setup ? needsSetup(this.setup.application.setupStatus) : false;
  }

  /** Answers that are missing or wrong right now. */
  get attentionCount(): number {
    return this.setup ? this.setup.evaluation.missing.length + this.setup.evaluation.invalid.length : 0;
  }

  load(): void {
    this.loading = true;
    this.service
      .getSetup(this.id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (setup) => {
          this.setup = setup;
          this.buildSummary();
        },
        error: () => void this.router.navigate(['/applications']),
      });
  }

  /** The tabs after the first load lazily - the audit trail can be long. */
  onTab(index: number): void {
    if (index >= 1 && !this.historyLoaded) {
      this.historyLoaded = true;
      this.loadAudit(1);
      this.service.getExecutions(this.id).subscribe((runs) => (this.executions = runs));
    }
  }

  loadAudit(page: number, pageSize = 20): void {
    this.service.getAudit(this.id, page, pageSize).subscribe((result) => (this.audit = result));
  }

  onAuditPage(event: PageEvent): void {
    this.loadAudit(event.pageIndex + 1, event.pageSize);
  }

  run(): void {
    if (!this.setup) {
      return;
    }
    this.blockedMissing = null;
    this.running = true;
    this.service
      .execute(this.id)
      .pipe(finalize(() => (this.running = false)))
      .subscribe({
        next: () => {
          this.notify.success(`${this.setup?.application.name} is running.`);
          this.historyLoaded = false;
          this.load();
        },
        error: (error: HttpErrorResponse) => {
          // The interceptor has shown the message ("Please complete the required setup..."); offer the way forward here.
          const missing = (error.error as { missing?: string[] } | null)?.missing;
          if (error.status === 409) {
            this.blockedMissing = missing ?? [];
            this.load();
          }
        },
      });
  }

  changePlan(): void {
    if (!this.setup) {
      return;
    }
    const data: ChangePlanDialogData = { application: this.setup.application };
    this.dialog
      .open(ChangePlanDialogComponent, { data, width: '720px', maxWidth: '95vw', disableClose: true })
      .afterClosed()
      .subscribe((updated: ApplicationSetup | undefined) => {
        if (updated) {
          this.notify.success(`Moved to ${updated.application.planName}. Your matching answers were kept.`);
          this.historyLoaded = false;
          this.blockedMissing = null;
          this.load();
        }
      });
  }

  migrate(): void {
    if (!this.setup) {
      return;
    }
    const data: ConfirmDialogData = {
      title: 'Update to the newest version?',
      message:
        `This moves "${this.setup.application.name}" to the latest version of ${this.setup.application.planName}. ` +
        'All your answers are kept; you may be asked for a few new details. Until then it keeps working on its current version.',
      confirmLabel: 'Update',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '480px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.migrating = true;
        this.service
          .migrate(this.id)
          .pipe(finalize(() => (this.migrating = false)))
          .subscribe(() => {
            this.notify.success('Updated to the newest version.');
            this.historyLoaded = false;
            this.load();
          });
      });
  }

  auditLabel(action: SetupAuditAction): string {
    return SETUP_AUDIT_LABELS[action];
  }

  /** Previous -> new for a changed answer, in the words the Talent used (multi-select lists read as plain text). */
  describeValue(value: string | null): string {
    if (value === null || value === '') {
      return '—';
    }
    let text = value;
    if (value.startsWith('[')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          text = parsed.join(', ');
        }
      } catch {
        // not a list - show as is
      }
    }
    return text.length > 90 ? `${text.slice(0, 87)}…` : text;
  }

  private buildSummary(): void {
    if (!this.setup) {
      this.summary = [];
      return;
    }
    const visible = new Set(this.setup.evaluation.visibleFieldKeys);
    this.summary = this.setup.definition.sections
      .map((section) => ({
        title: section.title,
        rows: section.fields
          .filter((f) => visible.has(f.fieldKey))
          .map((f) => ({ label: f.label, value: displayAnswer(f, this.setup!.values[f.fieldKey], this.currencySymbol) })),
      }))
      .filter((s) => s.rows.length > 0);
  }
}
