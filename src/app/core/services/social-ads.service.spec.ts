import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { SocialAdsService } from './social-ads.service';
import { environment } from '../../../environments/environment';
import { recentMonths, socialAdsRedirectUri } from '../models/social-ads.model';

describe('SocialAdsService', () => {
  let service: SocialAdsService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/social-ads`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(SocialAdsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the redirect address when asking for the Facebook login url', () => {
    let url = '';
    service.getConnectUrl('https://app.example.com/social-ads').subscribe((r) => (url = r.url));

    const req = http.expectOne((r) => r.url === `${baseUrl}/connect-url`);
    expect(req.request.params.get('redirectUri')).toBe('https://app.example.com/social-ads');
    req.flush({ url: 'https://www.facebook.com/dialog/oauth' });
    expect(url).toContain('facebook.com');
  });

  it('posts the one-time code, selects an account, syncs and disconnects', () => {
    service.connect({ code: 'c', state: 's', redirectUri: 'r' }).subscribe();
    http.expectOne(`${baseUrl}/connect`).flush({});

    service.selectAccount('42').subscribe();
    const select = http.expectOne(`${baseUrl}/select-account`);
    expect(select.request.body).toEqual({ adAccountId: '42' });
    select.flush({});

    service.sync().subscribe();
    expect(http.expectOne(`${baseUrl}/sync`).request.method).toBe('POST');

    service.disconnect().subscribe();
    const del = http.expectOne(baseUrl);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('saves typed-in monthly spend with PUT', () => {
    service.saveManualSpend({ month: '2026-08-01T00:00:00.000Z', amount: 900 }).subscribe();
    const req = http.expectOne(`${baseUrl}/manual-spend`);
    expect(req.request.method).toBe('PUT');
    req.flush(null);
  });
});

describe('social ads model helpers', () => {
  it('builds the redirect address Facebook returns to', () => {
    expect(socialAdsRedirectUri('https://app.example.com')).toBe('https://app.example.com/social-ads');
  });

  it('lists the most recent months newest first, as first-of-month dates', () => {
    const months = recentMonths(new Date(Date.UTC(2026, 9, 5)), 3);

    expect(months).toEqual(['2026-10-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', '2026-08-01T00:00:00.000Z']);
  });

  it('rolls back across a year boundary', () => {
    expect(recentMonths(new Date(Date.UTC(2026, 0, 15)), 2)).toEqual(['2026-01-01T00:00:00.000Z', '2025-12-01T00:00:00.000Z']);
  });
});
