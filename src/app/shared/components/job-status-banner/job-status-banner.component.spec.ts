import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { NEVER, Subject } from 'rxjs';
import { filter } from 'rxjs/operators';

import { NotificationHubService } from '../../../core/services/notification-hub.service';
import { SharedModule } from '../../shared.module';
import { JOB_FINISHED_BANNER_MS, JOB_RUNNING_BANNER_MS, JobStatusBannerComponent } from './job-status-banner.component';

/** The notification hub, with the job events in the test's hands. */
function fakeHub() {
  const started$ = new Subject<string>();
  const finished$ = new Subject<string>();
  return {
    started$,
    finished$,
    jobStarted: (types?: readonly string[]) => started$.pipe(filter((t) => !types || types.includes(t))),
    jobFinished: (types?: readonly string[]) => finished$.pipe(filter((t) => !types || types.includes(t))),
    connect: () => undefined,
    disconnect: () => undefined,
    notificationReceived$: NEVER,
  };
}

describe('JobStatusBannerComponent', () => {
  let fixture: ComponentFixture<JobStatusBannerComponent>;
  let hub: ReturnType<typeof fakeHub>;
  let startedEvents: number;
  let finishedEvents: number;

  const banner = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-testid="job-status-banner"]');
  const text = () => banner()?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  function create(inputs: Partial<JobStatusBannerComponent> = {}): void {
    fixture = TestBed.createComponent(JobStatusBannerComponent);
    fixture.componentInstance.jobTypes = ['lead-discovery'];
    fixture.componentInstance.label = 'Lead discovery';
    Object.assign(fixture.componentInstance, inputs);
    startedEvents = 0;
    finishedEvents = 0;
    fixture.componentInstance.started.subscribe(() => startedEvents++);
    fixture.componentInstance.finished.subscribe(() => finishedEvents++);
    fixture.detectChanges();
  }

  const emit = (subject: Subject<string>, jobType = 'lead-discovery') => {
    subject.next(jobType);
    fixture.detectChanges();
  };

  beforeEach(() => {
    hub = fakeHub();
    TestBed.configureTestingModule({
      imports: [SharedModule, NoopAnimationsModule],
      providers: [{ provide: NotificationHubService, useValue: hub }],
    });
  });

  it('shows nothing until the job does something', () => {
    create();

    expect(banner()).toBeNull();
  });

  it('says the job has started, in the blue of a notice, the moment it starts', () => {
    create();

    emit(hub.started$);

    expect(text()).toContain('Lead discovery started.');
    expect(text()).toContain('running for your account');
    expect(text()).toContain('updates by itself when it finishes');
    expect(banner()!.classList).toContain('job-status--running');
    expect(banner()!.getAttribute('role')).toBe('status');
    expect(startedEvents).toBe(1);
    expect(finishedEvents).toBe(0);
  });

  it('says the job has completed the moment it finishes, in green, and tells the page to refresh', () => {
    create();

    emit(hub.finished$);

    expect(text()).toContain('Lead discovery completed.');
    expect(text()).toContain('It has finished running.');
    expect(banner()!.classList).toContain('job-status--finished');
    expect(finishedEvents).toBe(1);
    expect(startedEvents).toBe(0);
  });

  it('says what the page now shows when it is told to', () => {
    create({ finishedHint: 'The list below shows the latest leads.' });

    emit(hub.finished$);

    expect(text()).toContain('The list below shows the latest leads.');
    expect(text()).not.toContain('It has finished running.');
  });

  it('is one banner whose state moves from running to completed, not two', () => {
    create();

    emit(hub.started$);
    emit(hub.finished$);

    expect((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="job-status-banner"]').length).toBe(1);
    expect(text()).toContain('completed');
    expect(text()).not.toContain('running for your account');
  });

  it('names the job it was given', () => {
    create({ label: 'Lead follow-ups', jobTypes: ['lead-follow-ups'] });

    emit(hub.started$, 'lead-follow-ups');

    expect(text()).toContain('Lead follow-ups started.');
  });

  it('ignores the other jobs - another job starting or finishing is not news on this page', () => {
    create();

    emit(hub.started$, 'lead-follow-ups');
    emit(hub.finished$, 'campaign-sends');

    expect(banner()).toBeNull();
    expect(startedEvents).toBe(0);
    expect(finishedEvents).toBe(0);
  });

  it('can be dismissed, and appears again for the next run', () => {
    create();
    emit(hub.started$);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-testid="job-status-dismiss"]')!.click();
    fixture.detectChanges();
    expect(banner()).toBeNull();

    emit(hub.started$);
    expect(text()).toContain('Lead discovery started.');
  });

  it('hides a completed banner by itself after a minute - it is only there for the moment', fakeAsync(() => {
    create();
    emit(hub.finished$);

    tick(JOB_FINISHED_BANNER_MS - 1);
    fixture.detectChanges();
    expect(banner()).not.toBeNull();

    tick(1);
    fixture.detectChanges();
    expect(banner()).toBeNull();
  }));

  it('stops saying a job is running after ten minutes with no finish, because a run that fails raises none', fakeAsync(() => {
    create();
    emit(hub.started$);

    tick(JOB_RUNNING_BANNER_MS - 1);
    fixture.detectChanges();
    expect(banner()).not.toBeNull();

    tick(1);
    fixture.detectChanges();
    expect(banner()).toBeNull();
  }));

  it('does not let the countdown of an earlier state hide a later one', fakeAsync(() => {
    create();
    emit(hub.started$);
    tick(JOB_RUNNING_BANNER_MS - 30 * 1000);   // the job finishes half a minute before the "running" countdown is due

    emit(hub.finished$);
    tick(31 * 1000);                           // the "running" countdown would have fired by now
    fixture.detectChanges();

    expect(text()).toContain('Lead discovery completed.');
    fixture.destroy();                         // the completed banner's own countdown is still pending
  }));

  it('shows a new run as running even while the last run\'s completed banner is still up', fakeAsync(() => {
    create();
    emit(hub.finished$);
    tick(30 * 1000);

    emit(hub.started$);
    tick(JOB_FINISHED_BANNER_MS);              // the completed banner's own countdown is long past
    fixture.detectChanges();

    expect(text()).toContain('Lead discovery started.');
    fixture.destroy();                         // the running banner's own countdown is still pending
  }));

  it('leaves nothing running after the page is gone', fakeAsync(() => {
    create();
    emit(hub.started$);

    fixture.destroy();

    expect(() => tick(JOB_RUNNING_BANNER_MS)).not.toThrow();   // a countdown left behind would fire into a destroyed view
    hub.started$.next('lead-discovery');                       // and the hub is no longer listened to
    expect(startedEvents).toBe(1);
  }));
});
