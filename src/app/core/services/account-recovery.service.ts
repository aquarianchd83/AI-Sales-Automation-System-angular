import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest } from '../models/recovery.model';

/** Getting back into an account, and proving an email address or phone number is yours. Every call here except the two for a signed-in
 * user is anonymous - the person using them cannot sign in yet. */
@Injectable({ providedIn: 'root' })
export class AccountRecoveryService {
  private readonly baseUrl = `${environment.apiBaseUrl}/auth`;

  constructor(private readonly http: HttpClient) {}

  forgotPassword(request: ForgotPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/reset-password`, request);
  }

  verifyEmail(request: VerifyEmailRequest): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/verify-email`, request);
  }

  resendVerificationEmail(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/resend-verification`, {});
  }

  /** Texts a code to the phone number on the signed-in user's profile. */
  sendPhoneCode(): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/phone/send-code`, {});
  }

  verifyPhone(code: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/phone/verify`, { code });
  }
}
