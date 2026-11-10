import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { PlatformStoryVideoRequestDetail } from '../../../core/models/story-studio.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformStoryVideoRequestService } from '../../../core/services/platform-story-video-request.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformRefundVideoDialogComponent } from '../platform-refund-video-dialog/platform-refund-video-dialog.component';
import { PlatformVideoRequestDetailComponent } from './platform-video-request-detail.component';

const detail = (over: Partial<PlatformStoryVideoRequestDetail> = {}): PlatformStoryVideoRequestDetail => ({
  id: 'r1', tenantId: 't1', tenantName: 'Bansal Corp', projectId: 'p1', title: 'Question hook', language: 'Hinglish', targetSeconds: 30,
  status: 'Raised', raisedAtUtc: '2026-11-09T09:00:00Z', scriptGeneratedAtUtc: null, videoReadyAtUtc: null, prepaidCredits: 1500, creditsRefunded: 0,
  topic: 'Sector: Real estate\nProblem: Finding customers is slow', audience: 'Small business owners', callToAction: 'Book a free demo',
  scriptText: null, videoUrl: null, videoFileName: null, videoSource: null, canGenerateVideo: false, rejectedReason: null, ...over,
});

describe('PlatformVideoRequestDetailComponent', () => {
  let fixture: ComponentFixture<PlatformVideoRequestDetailComponent>;
  let comp: PlatformVideoRequestDetailComponent;
  let api: jasmine.SpyObj<PlatformStoryVideoRequestService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const root = () => fixture.nativeElement as HTMLElement;
  const q = (selector: string) => root().querySelector(selector) as HTMLElement | null;
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const click = (selector: string) => {
    (q(selector) as HTMLElement).click();
    fixture.detectChanges();
  };
  const typeScript = (value: string) => {
    const box = q('[data-testid="script-text"]') as HTMLTextAreaElement;
    box.value = value;
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  function render(d: PlatformStoryVideoRequestDetail | 'missing' = detail(), id: string | null = 'r1'): void {
    api = jasmine.createSpyObj('PlatformStoryVideoRequestService', ['get', 'saveScript', 'uploadVideo']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    api.get.and.returnValue(d === 'missing' ? throwError(() => new Error('404')) : of(d));
    TestBed.configureTestingModule({
      declarations: [PlatformVideoRequestDetailComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformStoryVideoRequestService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    });
    fixture = TestBed.createComponent(PlatformVideoRequestDetailComponent);
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

  it('opens the request named in the address, with a way back to the list', () => {
    render();

    expect(api.get).toHaveBeenCalledWith('r1');
    expect(q('[data-testid="back-to-requests"]')?.getAttribute('href')).toBe('/platform/video-requests');
    expect(text(q('[data-testid="request-detail"]'))).toContain('Question hook');
    expect(text(q('[data-testid="request-detail"]'))).toContain('Bansal Corp');
    expect(text(q('[data-testid="brief"]'))).toContain('Finding customers is slow');
    expect(text(q('[data-testid="request-detail"]'))).toContain('Book a free demo');
    expect(text(q('[data-testid="paid"]'))).toContain('Prepaid by the tenant: 1,500 credits');
  });

  it('says so when the request cannot be found', () => {
    render('missing');

    expect(q('[data-testid="not-found"]')).not.toBeNull();
    expect(q('[data-testid="request-detail"]')).toBeNull();
  });

  describe('the script', () => {
    it('is a plain text box, and there is no Generate script button', () => {
      render();

      expect(q('[data-testid="script-text"]')).not.toBeNull();
      expect(q('[data-testid="save-script"]')).not.toBeNull();
      expect(q('[data-testid="generate-script"]')).toBeNull();
      expect(root().textContent).not.toContain('Generate script');
    });

    it('shows the saved script in the box, ready to change', async () => {
      render(detail({ status: 'ScriptReady', scriptText: 'Scene 1: hello.', scriptGeneratedAtUtc: '2026-11-09T10:00:00Z' }));
      await fixture.whenStable();
      fixture.detectChanges();

      expect((q('[data-testid="script-text"]') as HTMLTextAreaElement).value).toBe('Scene 1: hello.');
      expect(text(q('[data-testid="script-saved"]'))).toContain('The tenant can read it');
    });

    it('saves what was typed, trimmed, and says the tenant can read it', () => {
      render();
      api.saveScript.and.returnValue(of(detail({ status: 'ScriptReady', scriptText: 'Scene 1: hello.', scriptGeneratedAtUtc: '2026-11-09T10:00:00Z' })));
      typeScript('  Scene 1: hello.  ');
      expect(text(q('[data-testid="script-unsaved"]'))).toBe('Not saved yet.');

      click('[data-testid="save-script"]');

      expect(api.saveScript).toHaveBeenCalledOnceWith('r1', 'Scene 1: hello.');
      expect(notify.success).toHaveBeenCalledWith('Script saved. The tenant can read it.');
      expect(text(q('[data-testid="status"]'))).toBe('Script written');
      expect(q('[data-testid="script-unsaved"]')).toBeNull();
    });

    it('asks for something to be written first, and saves nothing', () => {
      render();
      typeScript('   ');

      click('[data-testid="save-script"]');

      expect(text(q('[data-testid="script-error"]'))).toBe('Write the script first.');
      expect(api.saveScript).not.toHaveBeenCalled();
    });

    it('is read-only once the video is attached', () => {
      render(detail({ status: 'VideoReady', scriptText: 'Scene 1: hello.', videoUrl: 'https://bucket.example/v.mp4' }));

      expect(q('[data-testid="script-text"]')).toBeNull();
      expect(q('[data-testid="save-script"]')).toBeNull();
      expect(text(q('[data-testid="script-readonly"]'))).toBe('Scene 1: hello.');
    });
  });

  describe('the video', () => {
    it('offers to upload, and shows that the system cannot make it yet', () => {
      render();

      expect(q('[data-testid="video-file"]')).not.toBeNull();
      expect(text(q('[data-testid="generate-unavailable"]'))).toContain('cannot make the video yet');
      expect(q('[data-testid="choice-generate"] input')?.hasAttribute('disabled')).toBeTrue();
    });

    it('asks for a file when none was chosen, and turns a non-video away', () => {
      render();

      click('[data-testid="upload-video"]');
      expect(text(q('[data-testid="file-error"]'))).toBe('Choose a video file first.');

      pickFile('notes.pdf', 'application/pdf');
      expect(text(q('[data-testid="file-error"]'))).toContain('Choose a video file');
      expect(api.uploadVideo).not.toHaveBeenCalled();
    });

    it('uploads the chosen video, shows its link, and says the tenant was told', () => {
      render();
      api.uploadVideo.and.returnValue(of(detail({ status: 'VideoReady', videoUrl: 'https://bucket.example/t1/promo.mp4', videoFileName: 'promo.mp4', videoSource: 'Uploaded', videoReadyAtUtc: '2026-11-10T09:00:00Z' })));
      pickFile('promo.mp4', 'video/mp4');

      click('[data-testid="upload-video"]');

      const [id, file] = api.uploadVideo.calls.mostRecent().args;
      expect(id).toBe('r1');
      expect(file.name).toBe('promo.mp4');
      expect((q('[data-testid="video-link"]') as HTMLAnchorElement).getAttribute('href')).toBe('https://bucket.example/t1/promo.mp4');
      expect(text(q('[data-testid="video-ready"]'))).toContain('The tenant has been told');
      expect(text(q('[data-testid="upload-video"]'))).toContain('Replace the video');
      expect(notify.success).toHaveBeenCalledWith('Video uploaded. The tenant has been told.');
    });
  });

  describe('the refund', () => {
    it('opens the refund dialog with this request, and shows the refund once it went through', () => {
      render();
      const refunded = detail({ status: 'Rejected', creditsRefunded: 1500, rejectedReason: 'The video engine could not make this one.' });
      const open = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(refunded) } as any);

      click('[data-testid="refund-open"]');

      const [component, config] = open.calls.mostRecent().args as [unknown, { data: unknown }];
      expect(component).toBe(PlatformRefundVideoDialogComponent);
      expect(config.data).toEqual({ requestId: 'r1', title: 'Question hook', tenantName: 'Bansal Corp', prepaidCredits: 1500 });
      expect(text(q('[data-testid="declined"]'))).toContain('Refunded: The video engine could not make this one.');
      expect(text(q('[data-testid="paid"]'))).toContain('(refunded)');
      expect(q('[data-testid="refund-open"]')).toBeNull();
      expect(q('[data-testid="video-card"]')).toBeNull();
      expect(q('[data-testid="save-script"]')).toBeNull();
      expect(notify.success).toHaveBeenCalledWith('Credits refunded. The tenant has been told.');
    });

    it('changes nothing when the dialog is closed without a refund', () => {
      render();
      spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(null) } as any);

      click('[data-testid="refund-open"]');

      expect(notify.success).not.toHaveBeenCalled();
      expect(comp.request?.status).toBe('Raised');
    });

    it('is not offered once the video is attached', () => {
      render(detail({ status: 'VideoReady', videoUrl: 'https://bucket.example/v.mp4' }));

      expect(q('[data-testid="refund-open"]')).toBeNull();
    });
  });
});
