import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { UpdateUserProfileRequest, UserProfile } from '../models/account.model';
import { UserPreferencesService } from './user-preferences.service';

/** The signed-in user's own profile — name, sign-in email, phone, display timezone and country. Available to
 * every role, including a PlatformSuperAdmin, who has no tenant and so appears on no Users screen. Changing
 * a password stays on AuthService, where it already lives. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly baseUrl = `${environment.apiBaseUrl}/account`;

  constructor(
    private readonly http: HttpClient,
    private readonly preferences: UserPreferencesService
  ) {}

  /** Also refreshes the cached display timezone, so timestamps render correctly from the first paint. */
  getProfile(): Observable<UserProfile> {
    return this.http
      .get<UserProfile>(`${this.baseUrl}/profile`)
      .pipe(tap((profile) => this.preferences.setTimezone(profile.timezone)));
  }

  updateProfile(request: UpdateUserProfileRequest): Observable<UserProfile> {
    return this.http
      .put<UserProfile>(`${this.baseUrl}/profile`, request)
      .pipe(tap((profile) => this.preferences.setTimezone(profile.timezone)));
  }
}
