import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformStoryVideoRequestDetail, PlatformStoryVideoRequestRow, StoryScriptVersion } from '../../../core/models/story-studio.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformStoryVideoRequestService } from '../../../core/services/platform-story-video-request.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformVideoRequestsComponent } from './platform-video-requests.component';

const row = (over: Partial<PlatformStoryVideoRequestRow> = {}): PlatformStoryVideoRequestRow => ({
  id: 'r1', tenantId: 't1', tenantName: 'Bansal Corp', projectId: 'p1', title: 'Question hook', language: 'Hinglish', targetSeconds: 30,
  status: 'Raised', raisedAtUtc: '2026-11-09T09:00:00Z', scriptGeneratedAtUtc: null, videoReadyAtUtc: null, prepaidCredits: 1500, creditsRefunded: 0, ...over,
});

const script = (simulated = false): StoryScriptVersion =>
  ({
    id: 'v1', number: 1, status: 0, source: 'AI', contentHash: 'h', isSimulated: simulated, createdAt: '2026-11-09T10:00:00Z',
    script: {
      title: 'Wardrobe in 10 days', description: 'd', hook: 'Tired of waiting?', storySummary: 's', language: 'Hinglish', punchline: 'Message us today',
      characters: [], scenes: [{ index: 1, dialogue: [{ speaker: 'Customer', text: 'Weeks for a wardrobe?', startMs: 0, endMs: 3000 }] }],
    },
  }) as unknown as StoryScriptVersion;

const detail = (over: Partial<PlatformStoryVideoRequestDetail> = {}): PlatformStoryVideoRequestDetail => ({
  ...row(), topic: 'Sector: Real estate\nProblem: Finding customers is slow', audience: 'Small business owners', callToAction: 'Book a free demo',
  script: null, videoUrl: null, videoFileName: null, videoSource: null, canGenerateVideo: false, rejectedReason: null, ...over,
});

describe('PlatformVideoRequestsComponent', () => {
  let fixture: ComponentFixture<PlatformVideoRequestsComponent>;
  let comp: PlatformVideoRequestsComponent;
  let api: jasmine.SpyObj<PlatformStoryVideoRequestService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const root = () => fixture.nativeElement as HTMLElement;
  const q = (selector: string) => root().querySelector(selector) as HTMLElement | null;
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const click = (selector: string) => {
    (q(selector) as HTMLElement).click();
    fixture.detectChanges();
  };

  function render(rows: PlatformStoryVideoRequestRow[] = [row(), row({ id: 'r2', tenantName: 'Other Co', title: 'Myth buster', status: 'VideoReady' })]): void {
    api = jasmine.createSpyObj('PlatformStoryVideoRequestService', ['getPaged', 'get', 'generateScript', 'uploadVideo', 'reject']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    api.getPaged.and.returnValue(of({ items: rows, totalCount: rows.length, page: 1, pageSize: 25, totalPages: 1 }));
    api.get.and.returnValue(of(detail()));
    TestBed.configureTestingModule({
      declarations: [PlatformVideoRequestsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformStoryVideoRequestService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(PlatformVideoRequestsComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  }

  function pickFile(name: string, type: string): void {
    const input = q('[data-testid="video-file"]') as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(new File(['abc'], name, { type }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
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

  it('filters by status', fakeAsync(() => {
    render();
    comp.statusControl.setValue('Raised');
    tick();

    expect(api.getPaged).toHaveBeenCalledWith(jasmine.objectContaining({ status: 'Raised', page: 1 }));
  }));

  it('opens a request to show what the tenant asked for, with no script yet', () => {
    render();
    click('[data-request="r1"]');

    expect(api.get).toHaveBeenCalledWith('r1');
    expect(text(q('[data-testid="brief"]'))).toContain('Finding customers is slow');
    expect(text(q('[data-testid="request-detail"]'))).toContain('Book a free demo');
    expect(q('[data-testid="no-script"]')).not.toBeNull();
  });

  describe('the script', () => {
    it('asks before writing, says the tenant is not charged again, and writes nothing until told to', () => {
      render();
      click('[data-request="r1"]');
      click('[data-testid="generate-script"]');

      expect(text(q('[data-testid="confirm-script"]'))).toContain('not charged again');
      expect(api.generateScript).not.toHaveBeenCalled();

      api.generateScript.and.returnValue(of(detail({ status: 'ScriptReady', script: script() })));
      click('[data-testid="confirm-script-yes"]');
      expect(api.generateScript).toHaveBeenCalledOnceWith('r1');
    });

    it('shows the script once written and says the tenant was not charged again', () => {
      render();
      click('[data-request="r1"]');
      api.generateScript.and.returnValue(of(detail({ status: 'ScriptReady', script: script() })));
      click('[data-testid="generate-script"]');
      click('[data-testid="confirm-script-yes"]');

      expect(text(q('[data-testid="script"]'))).toContain('Wardrobe in 10 days');
      expect(text(q('[data-testid="script"]'))).toContain('Scene 1, Customer: Weeks for a wardrobe?');
      expect(q('[data-testid="no-script"]')).toBeNull();
      expect(notify.success).toHaveBeenCalledWith(jasmine.stringContaining('not charged again'));
    });

    it('does not offer to rewrite the script once the video is attached', () => {
      render();
      api.get.and.returnValue(of(detail({ status: 'VideoReady', script: script(), videoUrl: 'https://bucket.example/v.mp4' })));
      click('[data-request="r2"]');

      expect(q('[data-testid="generate-script"]')).toBeNull();
    });
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

    it('opens that request with the refund form ready, and refunds nothing until a reason is given', () => {
      render();
      click('[data-refund="r1"]');

      expect(api.get).toHaveBeenCalledWith('r1');
      expect(q('[data-testid="decline-form"]')).not.toBeNull();
      expect(api.reject).not.toHaveBeenCalled();
      expect(text(q('[data-testid="decline-confirm"]'))).toBe('Refund 1,500 credits');
    });

    it('does not open the form when the request cannot be refunded any more', () => {
      render();
      api.get.and.returnValue(of(detail({ status: 'VideoReady', videoUrl: 'https://bucket.example/v.mp4' })));
      click('[data-request="r2"]');

      expect(q('[data-testid="decline-form"]')).toBeNull();
      expect(q('[data-testid="decline"]')).toBeNull();
    });
  });

  it('shows what the tenant prepaid for the video', () => {
    render();
    click('[data-request="r1"]');

    expect(text(q('[data-testid="paid"]'))).toContain('Prepaid by the tenant: 1,500 credits');
  });

  describe('declining', () => {
    it('asks for a reason first, and says how many credits go back', () => {
      render();
      click('[data-request="r1"]');
      click('[data-testid="decline"]');

      expect(text(q('[data-testid="decline-confirm"]'))).toContain('Refund 1,500 credits');
      click('[data-testid="decline-confirm"]');
      expect(text(q('[data-testid="decline-error"]'))).toContain('Say why');
      expect(api.reject).not.toHaveBeenCalled();
    });

    it('declines with the reason, shows it, and takes away the script and video actions', () => {
      render();
      click('[data-request="r1"]');
      api.reject.and.returnValue(of(detail({ status: 'Rejected', rejectedReason: 'The video engine could not make this one.', creditsRefunded: 1500 })));
      click('[data-testid="decline"]');
      const box = q('[data-testid="decline-reason"]') as HTMLTextAreaElement;
      box.value = '  The video engine could not make this one.  ';
      box.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      click('[data-testid="decline-confirm"]');

      expect(api.reject).toHaveBeenCalledOnceWith('r1', 'The video engine could not make this one.');
      expect(text(q('[data-testid="declined"]'))).toContain('Refunded: The video engine could not make this one.');
      expect(text(q('[data-testid="paid"]'))).toContain('(refunded)');
      expect(q('[data-testid="generate-script"]')).toBeNull();
      expect(q('[data-testid="video-file"]')).toBeNull();
      expect(q('[data-testid="decline"]')).toBeNull();
      expect(notify.success).toHaveBeenCalledWith('Credits refunded. The tenant has been told.');
    });

    it('cannot decline a request whose video is already attached', () => {
      render();
      api.get.and.returnValue(of(detail({ status: 'VideoReady', videoUrl: 'https://bucket.example/v.mp4' })));
      click('[data-request="r2"]');

      expect(q('[data-testid="decline"]')).toBeNull();
    });
  });

  describe('the video', () => {
    it('offers to upload, and shows that the system cannot make it yet', () => {
      render();
      click('[data-request="r1"]');

      expect(q('[data-testid="video-file"]')).not.toBeNull();
      expect(text(q('[data-testid="generate-unavailable"]'))).toContain('cannot make the video yet');
      expect(q('[data-testid="choice-generate"] input')?.hasAttribute('disabled')).toBeTrue();
    });

    it('asks for a file when none was chosen, and turns a non-video away', () => {
      render();
      click('[data-request="r1"]');

      click('[data-testid="upload-video"]');
      expect(text(q('[data-testid="file-error"]'))).toBe('Choose a video file first.');

      pickFile('notes.pdf', 'application/pdf');
      expect(text(q('[data-testid="file-error"]'))).toContain('Choose a video file');
      expect(api.uploadVideo).not.toHaveBeenCalled();
    });

    it('uploads the chosen video, shows its link, and says the tenant was told', () => {
      render();
      click('[data-request="r1"]');
      api.uploadVideo.and.returnValue(of(detail({ status: 'VideoReady', videoUrl: 'https://bucket.example/t1/promo.mp4', videoFileName: 'promo.mp4', videoSource: 'Uploaded', videoReadyAtUtc: '2026-11-10T09:00:00Z' })));
      pickFile('promo.mp4', 'video/mp4');

      click('[data-testid="upload-video"]');

      expect(api.uploadVideo).toHaveBeenCalledTimes(1);
      const [id, file] = api.uploadVideo.calls.mostRecent().args;
      expect(id).toBe('r1');
      expect(file.name).toBe('promo.mp4');
      const link = q('[data-testid="video-link"]') as HTMLAnchorElement;
      expect(link.getAttribute('href')).toBe('https://bucket.example/t1/promo.mp4');
      expect(text(q('[data-testid="video-ready"]'))).toContain('The tenant has been told');
      expect(text(q('[data-testid="upload-video"]'))).toContain('Replace the video');
      expect(notify.success).toHaveBeenCalledWith('Video uploaded. The tenant has been told.');
    });
  });
});
