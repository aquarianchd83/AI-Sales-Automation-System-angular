import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { StoryVideoRequestDetail } from '../../../core/models/story-studio.model';
import { StoryStudioService } from '../../../core/services/story-studio.service';
import { SharedModule } from '../../../shared/shared.module';
import { StudioStoryDetailComponent } from './studio-story-detail.component';

const request = (over: Partial<StoryVideoRequestDetail> = {}): StoryVideoRequestDetail => ({
  id: 'q1', projectId: 'p1', title: 'AI Lead Discovery', language: 'Hinglish', targetSeconds: 30, status: 'Raised', raisedAtUtc: '2026-11-09T09:00:00Z',
  scriptGeneratedAtUtc: null, videoReadyAtUtc: null, topic: 'Sector: Real estate\nProblem: Find potential customers.', audience: 'Small business owners',
  callToAction: 'Book a free demo', scriptText: null, videoUrl: null, videoFileName: null, rejectedReason: null, prepaidCredits: 1500, creditsRefunded: 0, ...over,
});

describe('StudioStoryDetailComponent', () => {
  let fixture: ComponentFixture<StudioStoryDetailComponent>;
  let api: jasmine.SpyObj<StoryStudioService>;
  let navigate: jasmine.Spy;

  const q = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLElement | null;
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(r: StoryVideoRequestDetail | 'missing' = request(), id: string | null = 'q1'): void {
    api = jasmine.createSpyObj('StoryStudioService', ['getRequest', 'downloadRequestVideo']);
    api.getRequest.and.returnValue(r === 'missing' ? throwError(() => new Error('404')) : of(r));
    TestBed.configureTestingModule({
      declarations: [StudioStoryDetailComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: StoryStudioService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(StudioStoryDetailComponent);
    fixture.detectChanges();
  }

  it('opens the request named in the address, with a way back to the stories', () => {
    render();

    expect(api.getRequest).toHaveBeenCalledWith('q1');
    expect(q('[data-testid="back-to-stories"]')?.getAttribute('href')).toBe('/content-studio/stories');
    expect(text(q('[data-testid="summary"]'))).toContain('AI Lead Discovery');
    expect(text(q('[data-testid="status"]'))).toBe('Requested');
    expect(text(q('[data-testid="credits"]'))).toBe('Credits prepaid: 1,500');
    expect(text(q('[data-testid="brief"]'))).toContain('Find potential customers.');
    expect(text(q('[data-testid="brief-card"]'))).toContain('Book a free demo');
  });

  it('says so when the story cannot be found', () => {
    render('missing');

    expect(q('[data-testid="not-found"]')).not.toBeNull();
    expect(q('[data-testid="summary"]')).toBeNull();
  });

  it('promises a refund while the video is still being made, and says the script is not written yet', () => {
    render();

    expect(text(q('[data-testid="promise"]'))).toContain('If the video is not created, the credits you prepaid are refunded in full.');
    expect(text(q('[data-testid="no-script"]'))).toContain('has not written the script yet');
    expect(q('[data-testid="video"]')).toBeNull();
  });

  it('shows the script once the platform team has written it', () => {
    render(request({ status: 'ScriptReady', scriptText: 'Scene 1: Still searching for leads?' }));

    expect(text(q('[data-testid="status"]'))).toBe('Script written');
    expect(text(q('[data-testid="script"]'))).toBe('Scene 1: Still searching for leads?');
    expect(q('[data-testid="no-script"]')).toBeNull();
  });

  it('shows the reason, on the page, when the credits were refunded', () => {
    render(request({ status: 'Rejected', creditsRefunded: 1500, rejectedReason: 'The video engine could not make this one.' }));

    expect(text(q('[data-testid="status"]'))).toBe('Refunded');
    expect(text(q('[data-testid="refunded"]'))).toContain('Your credits were refunded.');
    expect(text(q('[data-testid="refund-reason"]'))).toBe('Reason: The video engine could not make this one.');
    expect(text(q('[data-testid="credits"]'))).toBe('Credits prepaid: 1,500 (refunded)');
    expect(q('[data-testid="promise"]')).toBeNull();
  });

  describe('once the video is ready', () => {
    const ready = () => request({ status: 'VideoReady', videoUrl: 'https://bucket.example/t/guru.mp4', videoReadyAtUtc: '2026-11-10T09:00:00Z' });

    it('offers to watch it in a new tab', () => {
      render(ready());

      const watch = q('[data-testid="watch"]') as HTMLAnchorElement;
      expect(watch.getAttribute('href')).toBe('https://bucket.example/t/guru.mp4');
      expect(watch.getAttribute('target')).toBe('_blank');
    });

    it('downloads it as a file named after the story', () => {
      render(ready());
      api.downloadRequestVideo.and.returnValue(of(new Blob(['abc'], { type: 'video/webm' })));
      spyOn(URL, 'createObjectURL').and.returnValue('blob:video');
      spyOn(URL, 'revokeObjectURL');
      let saved: HTMLAnchorElement | null = null;
      spyOn(HTMLAnchorElement.prototype, 'click').and.callFake(function (this: HTMLAnchorElement) {
        saved = this;
      });

      (q('[data-testid="download"]') as HTMLElement).click();

      expect(api.downloadRequestVideo).toHaveBeenCalledOnceWith('q1');
      expect(saved!.download).toBe('AI Lead Discovery.webm');
    });
  });

  it('has no video section until there is a video', () => {
    render(request({ status: 'ScriptReady', scriptText: 'x' }));

    expect(q('[data-testid="watch"]')).toBeNull();
    expect(q('[data-testid="download"]')).toBeNull();
  });

  it('clones the story: New story opens with the same answers', () => {
    render();

    (q('[data-testid="clone"]') as HTMLElement).click();

    expect(navigate).toHaveBeenCalledWith(['/content-studio/stories/new'], { queryParams: { clone: 'p1' } });
  });
});
