import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { SharedModule } from '../../shared/shared.module';
import { SocialAdsStatus } from '../../core/models/social-ads.model';
import { SocialAdsComponent } from './social-ads.component';

const base: SocialAdsStatus = {
  isAvailable: true,
  status: 'NotConnected',
  adAccountId: null,
  adAccountName: null,
  currencyCode: null,
  connectedAt: null,
  lastSyncedAt: null,
  lastSyncError: null,
  tokenExpiresAt: null,
  accounts: [],
};

describe('SocialAdsComponent', () => {
  let fixture: ComponentFixture<SocialAdsComponent>;
  let component: SocialAdsComponent;
  let http: HttpTestingController;
  let router: Router;

  function create(query: Record<string, string> = {}): void {
    TestBed.configureTestingModule({
      declarations: [SocialAdsComponent],
      imports: [SharedModule, HttpClientTestingModule, RouterTestingModule, NoopAnimationsModule],
      providers: [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(SocialAdsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  }

  const url = (suffix: string) => (r: { url: string }) => r.url.endsWith(`/social-ads${suffix}`);

  function flushLoad(status: SocialAdsStatus): void {
    http.expectOne(url('')).flush(status);
    http.expectOne(url('/manual-spend')).flush([]);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  it('offers the one-click connect for a tenant that has not connected', () => {
    create();
    fixture.detectChanges();
    flushLoad(base);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Connect with Facebook');
    expect(text).toContain('Read-only');
  });

  it('explains when the platform has no Meta App yet instead of offering a button that cannot work', () => {
    create();
    fixture.detectChanges();
    flushLoad({ ...base, isAvailable: false });

    const root = fixture.nativeElement as HTMLElement;
    const connectButtons = Array.from(root.querySelectorAll('button')).filter((b) => b.textContent?.includes('Connect with Facebook'));
    expect(root.textContent).toContain("isn't switched on for this platform yet");
    expect(connectButtons.length).toBe(0);
  });

  it('finishes the login Facebook redirected back with, then removes the single-use code from the address', () => {
    create({ code: 'abc', state: 'st' });
    fixture.detectChanges();

    const req = http.expectOne(url('/connect'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body.code).toBe('abc');
    expect(req.request.body.state).toBe('st');
    expect(req.request.body.redirectUri).toBe(`${window.location.origin}/social-ads`);
    req.flush({ ...base, status: 'Connected', adAccountId: '1', adAccountName: 'Acme Ads', currencyCode: 'INR', connectedAt: '2026-10-05T00:00:00Z' });
    http.expectOne(url('/manual-spend')).flush([]);
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/social-ads'], { replaceUrl: true });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Acme Ads');
  });

  it('lets the tenant pick an ad account when the login has several', () => {
    create();
    fixture.detectChanges();
    flushLoad({
      ...base,
      status: 'PendingAccountSelection',
      accounts: [
        { id: '1', name: 'Shop A', currencyCode: 'INR' },
        { id: '2', name: 'Shop B', currencyCode: 'INR' },
      ],
    });

    expect(component.accountControl.value).toBe('1');
    component.accountControl.setValue('2');
    component.useSelectedAccount();

    const req = http.expectOne(url('/select-account'));
    expect(req.request.body).toEqual({ adAccountId: '2' });
    req.flush({ ...base, status: 'Connected', adAccountId: '2', adAccountName: 'Shop B', currencyCode: 'INR' });
    expect(component.isConnected).toBeTrue();
  });

  it('shows a cancelled login as a message, without trying to connect', () => {
    create({ error: 'access_denied' });
    fixture.detectChanges();
    flushLoad(base);

    expect(component.message).toContain('cancelled');
  });

  it('asks the tenant to reconnect when Facebook stopped accepting the saved login', () => {
    create();
    fixture.detectChanges();
    flushLoad({ ...base, status: 'NeedsReconnect', adAccountName: 'Acme Ads', lastSyncError: 'Please connect again.' });

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Please reconnect Facebook');
    expect(text).toContain('Please connect again.');
  });

  it('saves a typed-in month and clears one with an amount of 0', () => {
    create();
    fixture.detectChanges();
    flushLoad(base);

    component.manualForm.setValue({ month: component.months[1], amount: 900 });
    component.saveManual();
    const put = http.expectOne(url('/manual-spend'));
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ month: component.months[1], amount: 900 });
    put.flush({ month: component.months[1], amount: 900, currencyCode: 'INR' });
    http.expectOne((r) => r.url.endsWith('/social-ads/manual-spend') && r.method === 'GET').flush([]);

    component.clearManual({ month: component.months[1], amount: 900, currencyCode: 'INR' });
    const clear = http.expectOne(url('/manual-spend'));
    expect(clear.request.body.amount).toBe(0);
    clear.flush(null);
    http.expectOne((r) => r.url.endsWith('/social-ads/manual-spend') && r.method === 'GET').flush([]);
  });

  it('shows the Meta app setup steps with the exact redirect address to register', () => {
    create();
    fixture.detectChanges();
    flushLoad(base);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(component.redirectUri).toBe(`${window.location.origin}/social-ads`);
    expect(text).toContain('Meta app setup');
    expect(text).toContain('Valid OAuth Redirect URIs');
    expect(text).toContain(component.redirectUri);
    expect(text).toContain('ads_read');
    expect(text).toContain('How to connect');
  });

  it('opens the Meta setup steps by default when the platform has no Meta App yet', () => {
    create();
    fixture.detectChanges();
    flushLoad({ ...base, isAvailable: false });

    const panels = (fixture.nativeElement as HTMLElement).querySelectorAll('mat-expansion-panel.guide');
    const setup = Array.from(panels).find((p) => p.textContent?.includes('Meta app setup'));
    expect(setup?.classList.contains('mat-expanded')).toBeTrue();
  });

  it('copies the redirect address to the clipboard', async () => {
    create();
    fixture.detectChanges();
    flushLoad(base);
    const write = jasmine.createSpy('writeText').and.resolveTo();
    spyOnProperty(navigator, 'clipboard', 'get').and.returnValue({ writeText: write } as unknown as Clipboard);

    component.copyRedirectUri();
    await fixture.whenStable();

    expect(write).toHaveBeenCalledWith(component.redirectUri);
  });
});
