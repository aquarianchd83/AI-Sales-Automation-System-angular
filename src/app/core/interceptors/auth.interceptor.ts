import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';

/** Endpoints that must never carry a bearer token or trigger a refresh loop. */
const ANONYMOUS_PATHS = ['/auth/login', '/auth/refresh-token'];

/**
 * Attaches the access token and, on a 401, transparently rotates the token pair
 * once and replays the failed request. AuthService shares a single in-flight
 * refresh, so a burst of parallel 401s produces one refresh call.
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private readonly tokens: TokenStorageService,
    private readonly auth: AuthService
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const isApiCall = req.url.startsWith(environment.apiBaseUrl);
    const isAnonymous = ANONYMOUS_PATHS.some((path) => req.url.includes(path));

    if (!isApiCall || isAnonymous) {
      return next.handle(req);
    }

    return next.handle(this.withToken(req)).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.retryWithRefreshedToken(req, next, error);
        }
        return throwError(() => error);
      })
    );
  }

  private retryWithRefreshedToken(
    req: HttpRequest<unknown>,
    next: HttpHandler,
    originalError: HttpErrorResponse
  ): Observable<HttpEvent<unknown>> {
    if (!this.tokens.refreshToken) {
      this.auth.forceLogout();
      return throwError(() => originalError);
    }

    return this.auth.refreshAccessToken().pipe(
      switchMap(() => next.handle(this.withToken(req))),
      catchError(() => {
        // Refresh itself failed — the session is unrecoverable. AuthService has
        // already cleared it; bounce to /login preserving where the user was.
        this.auth.forceLogout(location.pathname + location.search);
        return throwError(() => originalError);
      })
    );
  }

  private withToken(req: HttpRequest<unknown>): HttpRequest<unknown> {
    const token = this.tokens.accessToken;
    return token
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;
  }
}
