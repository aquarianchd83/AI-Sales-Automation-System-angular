import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AccountRecoveryService } from './account-recovery.service';

describe('AccountRecoveryService', () => {
  let service: AccountRecoveryService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/auth`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AccountRecoveryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for a reset by email or sms', () => {
    service.forgotPassword({ email: 'a@b.com', channel: 'sms' }).subscribe();

    const req = http.expectOne(`${base}/forgot-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'a@b.com', channel: 'sms' });
    req.flush(null);
  });

  it('sends the token or code with the new password', () => {
    service.resetPassword({ email: 'a@b.com', token: '123456', newPassword: 'New-Passw0rd!', channel: 'sms' }).subscribe();

    const req = http.expectOne(`${base}/reset-password`);
    expect(req.request.body).toEqual({ email: 'a@b.com', token: '123456', newPassword: 'New-Passw0rd!', channel: 'sms' });
    req.flush(null);
  });

  it('verifies an email, and a phone with a code', () => {
    service.verifyEmail({ email: 'a@b.com', token: 'tok' }).subscribe();
    http.expectOne(`${base}/verify-email`).flush(null);

    service.verifyPhone('482913').subscribe();
    const req = http.expectOne(`${base}/phone/verify`);
    expect(req.request.body).toEqual({ code: '482913' });
    req.flush(null);
  });

  it('texts a code and resends the verification email for the signed-in user', () => {
    service.sendPhoneCode().subscribe();
    http.expectOne(`${base}/phone/send-code`).flush(null);

    service.resendVerificationEmail().subscribe();
    http.expectOne(`${base}/resend-verification`).flush(null);
  });
});
