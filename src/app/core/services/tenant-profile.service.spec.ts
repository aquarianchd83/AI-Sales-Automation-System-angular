import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { TenantProfileService } from './tenant-profile.service';

describe('TenantProfileService keyword suggestions', () => {
  it('posts the industry, description and existing keywords, and returns what the API suggests', () => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    const service = TestBed.inject(TenantProfileService);
    const backend = TestBed.inject(HttpTestingController);

    let result: unknown;
    service
      .suggestKeywords({ industry: 'Healthcare', businessDescription: null, existing: ['dental care'] })
      .subscribe((r) => (result = r));

    const request = backend.expectOne(`${environment.apiBaseUrl}/tenant-profile/keyword-suggestions`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ industry: 'Healthcare', businessDescription: null, existing: ['dental care'] });
    request.flush({ keywords: ['eye care'], source: 'Common terms' });

    expect(result).toEqual({ keywords: ['eye care'], source: 'Common terms' });
    backend.verify();
  });
});
