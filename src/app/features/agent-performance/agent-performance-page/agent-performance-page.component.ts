import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, of } from 'rxjs';
import { catchError, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import {
  AGENT_PERFORMANCE_WINDOWS,
  AgentPerformanceReport,
  QualificationFieldStats,
  askEffectivenessClass,
  validationCodeMeaning,
} from '../../../core/models/agent-performance.model';
import { AgentPerformanceService } from '../../../core/services/agent-performance.service';

/** Below this many asks, a low answer rate is noise rather than a badly phrased question. */
const MinAsksToJudge = 5;

const StrugglingBelow = 0.33;

function computeHotLift(report: AgentPerformanceReport | null): number | null {
  const leads = report?.leads;
  if (!leads || leads.hotLeadsDetected === 0 || leads.otherConversionRate === 0) {
    return null;
  }
  return leads.hotConversionRate / leads.otherConversionRate;
}

@Component({
  selector: 'app-agent-performance-page',
  templateUrl: './agent-performance-page.component.html',
  styleUrls: ['./agent-performance-page.component.scss'],
})
export class AgentPerformancePageComponent implements OnInit, OnDestroy {
  readonly windows = AGENT_PERFORMANCE_WINDOWS;
  readonly effectivenessClass = askEffectivenessClass;
  readonly codeMeaning = validationCodeMeaning;

  readonly fieldColumns = [
    'field',
    'asked',
    'captured',
    'effectiveness',
    'turnsToCapture',
  ];
  readonly failureColumns = ['code', 'occurrences', 'conversations', 'share'];

  report: AgentPerformanceReport | null = null;
  loading = true;
  days = 30;

  /**
   * The fields worth acting on: asked enough times to mean something, and answered less than a third
   * of the time.
   *
   * The floor matters. A field asked twice and answered never is noise, and putting it at the top of
   * an admin's screen teaches them to ignore the list.
   */
  strugglingFields: QualificationFieldStats[] = [];

  /** How much more often a lead marked hot closes than the rest. Null when nothing has been marked
   * hot yet, or when nobody else has closed either - a ratio against zero would read as a failure
   * rather than as "no evidence either way". */
  hotLift: number | null = null;

  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly performance: AgentPerformanceService) {}

  ngOnInit(): void {
    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.performance.getReport(this.days).pipe(
            catchError(() => of(null)),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((report) => {
        this.report = report;
        // Derived once per load rather than from a getter: a getter returning a fresh array on every
        // change-detection pass would re-render the list it feeds for no reason.
        this.strugglingFields = (report?.fields ?? []).filter(
          (f) => f.conversationsAsked >= MinAsksToJudge && f.askEffectiveness < StrugglingBelow
        );
        this.hotLift = computeHotLift(report);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setWindow(days: number): void {
    if (this.days === days) {
      return;
    }
    this.days = days;
    this.reload$.next();
  }
}
