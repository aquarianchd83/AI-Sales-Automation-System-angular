import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { PublicConsentService } from './public-consent.service';

describe('PublicConsentService', () => {
  let service: PublicConsentService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/public/consent`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(PublicConsentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('opening a link is a GET and nothing else', () => {
    service.getPage('tok').subscribe();

    const req = http.expectOne(`${baseUrl}/tok`);
    expect(req.request.method).toBe('GET');
    req.flush({ state: 'Ready', page: null, decision: null, message: null });
  });

  it('a choice is a POST with the checkbox and the version the customer saw', () => {
    service.decide('tok', { decision: 'agree', consentChecked: true, pageVersion: 3 }).subscribe();

    const req = http.expectOne(`${baseUrl}/tok/decision`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'agree', consentChecked: true, pageVersion: 3 });
    req.flush({ outcome: 'Recorded', decision: 'Granted', message: 'ok', page: null });
  });

  it('puts the secret in the path encoded, so it cannot break out of it', () => {
    service.getPage('a/b?c').subscribe();

    http.expectOne(`${baseUrl}/a%2Fb%3Fc`).flush({ state: 'Invalid', page: null, decision: null, message: null });
  });

  it('turns a 404 with a result body into a result, not an error', (done) => {
    service.getPage('nope').subscribe((page) => {
      expect(page.state).toBe('Invalid');
      done();
    });

    http.expectOne(`${baseUrl}/nope`).flush({ state: 'Invalid', page: null, decision: null, message: 'This link is not valid.' }, { status: 404, statusText: 'Not Found' });
  });

  it('turns a 409 refusal into a result the page can explain', (done) => {
    service.decide('tok', { decision: 'agree', consentChecked: true, pageVersion: 1 }).subscribe((result) => {
      expect(result.outcome).toBe('Conflict');
      done();
    });

    http.expectOne(`${baseUrl}/tok/decision`).flush({ outcome: 'Conflict', decision: 'NotInterested', message: 'm', page: null }, { status: 409, statusText: 'Conflict' });
  });

  it('still raises a failure to reach the API, or a server error', (done) => {
    service.getPage('tok').subscribe({
      error: (error) => {
        expect(error.status).toBe(500);
        done();
      },
    });

    http.expectOne(`${baseUrl}/tok`).flush('boom', { status: 500, statusText: 'Server Error' });
  });

  it('does not swallow a rate limit as if it were an answer', (done) => {
    service.getPage('tok').subscribe({
      error: (error) => {
        expect(error.status).toBe(429);
        done();
      },
    });

    http.expectOne(`${baseUrl}/tok`).flush({ title: 'Too many requests.', status: 429, state: 'x' }, { status: 429, statusText: 'Too Many Requests' });
  });
});
