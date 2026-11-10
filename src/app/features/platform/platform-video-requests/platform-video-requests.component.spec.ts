import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformStoryVideoRequestDetail, PlatformStoryVideoRequestRow } from '../../../core/models/story-studio.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformStoryVideoRequestService } from '../../../core/services/platform-story-video-request.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformRefundVideoDialogComponent } from '../platform-refund-video-dialog/platform-refund-video-dialog.component';
import { PlatformVideoRequestsComponent } from './platform-video-requests.component';

const row = (over: Partial<PlatformStoryVideoRequestRow> = {}): PlatformStoryVideoRequestRow => ({
  id: 'r1', tenantId: 't1', tenantName: 'Bansal Corp', projectId: 'p1', title: 'Question hook', language: 'Hinglish', targetSeconds: 30,
  status: 'Raised', raisedAtUtc: '2026-11-09T09:00:00Z', scriptGeneratedAtUtc: null, videoReadyAtUtc: null, prepaidCredits: 1500, creditsRefunded: 0, ...over,
});

const refundedDetail = (): PlatformStoryVideoRequestDetail =>
  ({ ...row({ status: 'Rejected', creditsRefunded: 1500 }), rejectedReason: 'Could not be made.' }) as unknown as PlatformStoryVideoRequestDetail;

describe('PlatformVideoRequestsComponent', () => {
  let fixture: ComponentFixture<PlatformVideoRequestsComponent>;
  let comp: PlatformVideoRequestsComponent;
  let api: jasmine.SpyObj<PlatformStoryVideoRequestService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let navigate: jasmine.Spy;

  const root = () => fixture.nativeElement as HTMLElement;
  const q = (selector: string) => root().querySelector(selector) as HTMLElement | null;
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const click = (selector: string) => {
    (q(selector) as HTMLElement).click();
    fixture.detectChanges();
  };

  function render(rows: PlatformStoryVideoRequestRow[] = [row(), row({ id: 'r2', tenantName: 'Other Co', title: 'Myth buster', status: 'VideoReady' })]): void {
    api = jasmine.createSpyObj('PlatformStoryVideoRequestService', ['getPaged']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    api.getPaged.and.returnValue(of({ items: rows, totalCount: rows.length, page: 1, pageSize: 25, totalPages: 1 }));
    TestBed.configureTestingModule({
      declarations: [PlatformVideoRequestsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformStoryVideoRequestService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(PlatformVideoRequestsComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('lists every tenant\'s requests with the tenant, the story and where it stands', () => {
    render();

    const rows = Array.from(root().querySelectorAll('[data-testid="requests-table"] tr.request-row')).map((r) => text(r));
    expect(rows.length).toBe(2);
    expect(rows[0]).toContain('Bansal Corp');
    expect(rows[0]).toContain('Question hook');
    expect(rows[0]).toContain('Requested');
    expect(rows[1]).toContain('Other Co');
    expect(rows[1]).toContain('Video ready');
    expect(text(root())).toContain('2 requests');
  });

  it('filters by status, including refunded requests', fakeAsync(() => {
    render();
    expect(comp.statuses).toContain('Rejected');

    comp.statusControl.setValue('Raised');
    tick();

    expect(api.getPaged).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'Raised', page: 1 }));
  }));

  it('opens a request on its own page when its row is clicked', () => {
    render();
    click('[data-request="r1"]');

    expect(navigate).toHaveBeenCalledWith(['/platform/video-requests', 'r1']);
    expect(q('[data-testid="request-detail"]')).toBeNull();   // no panel under the grid any more
  });

  it('shows the prepaid credits of every request in the grid, and marks the refunded ones', () => {
    render([row(), row({ id: 'r2', title: 'Myth buster', status: 'Rejected', creditsRefunded: 1500 }), row({ id: 'r3', title: 'Old', prepaidCredits: null })]);

    const cells = Array.from(root().querySelectorAll('[data-testid="prepaid"]')).map((c) => text(c));
    expect(cells[0]).toBe('1,500');
    expect(cells[1]).toBe('1,500 refunded');
    expect(cells[2]).toBe('-');
    expect(text(root().querySelector('th.num'))).toBe('Prepaid credits');
  });

  describe('the Refund button in the grid', () => {
    it('is offered on a request that is waiting, and not on a delivered or already refunded one', () => {
      render([row(), row({ id: 'r2', status: 'ScriptReady' }), row({ id: 'r3', status: 'VideoReady' }), row({ id: 'r4', status: 'Rejected' })]);

      expect(q('[data-refund="r1"]')).not.toBeNull();
      expect(q('[data-refund="r2"]')).not.toBeNull();
      expect(q('[data-refund="r3"]')).toBeNull();
      expect(q('[data-refund="r4"]')).toBeNull();
    });

    it('opens the refund dialog for that request, and does not open the request', () => {
      render();
      const open = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(null) } as any);

      click('[data-refund="r1"]');

      expect(open).toHaveBeenCalledTimes(1);
      const [component, config] = open.calls.mostRecent().args as [unknown, { data: unknown }];
      expect(component).toBe(PlatformRefundVideoDialogComponent);
      expect(config.data).toEqual({ requestId: 'r1', title: 'Question hook', tenantName: 'Bansal Corp', prepaidCredits: 1500 });
      expect(navigate).not.toHaveBeenCalled();
    });

    it('reads the grid again and says the tenant was told once the refund went through', () => {
      render();
      spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(refundedDetail()) } as any);
      api.getPaged.calls.reset();

      click('[data-refund="r1"]');

      expect(notify.success).toHaveBeenCalledWith('Credits refunded. The tenant has been told.');
      expect(api.getPaged).toHaveBeenCalledTimes(1);
    });

    it('does nothing when the dialog is closed without a refund', () => {
      render();
      spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(null) } as any);
      api.getPaged.calls.reset();

      click('[data-refund="r1"]');

      expect(notify.success).not.toHaveBeenCalled();
      expect(api.getPaged).not.toHaveBeenCalled();
    });
  });
});
