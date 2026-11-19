import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject, merge, timer } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

import { NotificationHubService } from '../../../core/services/notification-hub.service';

/** How long a "started" banner waits for its job to finish. A run that fails raises no finish of its own that a tenant is told about,
 * so without a limit the banner would say "running" for ever. */
export const JOB_RUNNING_BANNER_MS = 10 * 60 * 1000;

/** How long a "completed" banner stays: it is there for the moment, and the page it sits on has already been refreshed. */
export const JOB_FINISHED_BANNER_MS = 60 * 1000;

/**
 * Tells the tenant, on the page that shows what a background job produces, that the job has started running and that it has finished - the same
 * blue note a page uses for a notice, in this page's own spot, appearing the moment it happens. It follows the live job events the
 * notification hub already carries, so nothing is polled, and the page it sits on can refresh itself on `finished`.
 *
 * Only a tenant Admin has the live channel (the shell opens it for the people the bell is for); for anyone else this simply never appears.
 */
@Component({
  selector: 'app-job-status-banner',
  templateUrl: './job-status-banner.component.html',
  styleUrls: ['./job-status-banner.component.scss'],
})
export class JobStatusBannerComponent implements OnInit, OnDestroy {
  /** The job types to follow - a job's key, e.g. "lead-discovery". Events for any other job are ignored. */
  @Input() jobTypes: readonly string[] = [];

  /** The job's name as the tenant knows it: "Lead discovery". */
  @Input() label = 'The job';

  /** What to say once it has finished, about the page itself: "The list below is up to date." */
  @Input() finishedHint = '';

  /** The job has just started running. */
  @Output() started = new EventEmitter<void>();

  /** The job has just finished (whatever the outcome), already recorded on the server - so the page can refetch what it changed. */
  @Output() finished = new EventEmitter<void>();

  state: 'idle' | 'running' | 'finished' = 'idle';

  private readonly cancelTimer$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly notificationHub: NotificationHubService) {}

  ngOnInit(): void {
    this.notificationHub
      .jobStarted(this.jobTypes)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.show('running', JOB_RUNNING_BANNER_MS);
        this.started.emit();
      });

    this.notificationHub
      .jobFinished(this.jobTypes)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.show('finished', JOB_FINISHED_BANNER_MS);
        this.finished.emit();
      });
  }

  ngOnDestroy(): void {
    this.cancelTimer$.next();
    this.destroy$.next();
    this.destroy$.complete();
  }

  dismiss(): void {
    this.cancelTimer$.next();
    this.state = 'idle';
  }

  /** One banner whose state moves from running to finished and back: a new state replaces the old one and starts its own countdown. */
  private show(state: 'running' | 'finished', visibleFor: number): void {
    this.cancelTimer$.next();
    this.state = state;
    timer(visibleFor)
      .pipe(takeUntil(merge(this.cancelTimer$, this.destroy$)))
      .subscribe(() => (this.state = 'idle'));
  }
}
