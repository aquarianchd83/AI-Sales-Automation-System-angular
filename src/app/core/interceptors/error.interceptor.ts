import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { NotificationService } from '../services/notification.service';

/** ASP.NET Core ProblemDetails / ValidationProblemDetails shape. */
interface ProblemDetails {
  title?: string;
  detail?: string;
  status?: number;
  errors?: Record<string, string[]>;
}

/**
 * Turns API failures into a single readable toast, then rethrows so callers can
 * still react (e.g. re-enable a submit button). 401 is skipped — AuthInterceptor
 * owns that path and either refreshes silently or redirects to /login.
 */
@Injectable()
export class ErrorInterceptor implements HttpInterceptor {
  constructor(private readonly notify: NotificationService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status !== 401) {
          this.notify.error(this.toMessage(error));
        }
        return throwError(() => error);
      })
    );
  }

  private toMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Cannot reach the API. Is the backend running, and does proxy.conf.json point at the right port?';
    }

    const problem = error.error as ProblemDetails | string | null;

    if (typeof problem === 'string' && problem.trim()) {
      return problem;
    }

    if (problem && typeof problem === 'object') {
      const validationMessages = Object.values(problem.errors ?? {}).flat();
      if (validationMessages.length) {
        return validationMessages.join(' ');
      }
      if (problem.detail) {
        return problem.detail;
      }
      if (problem.title) {
        return problem.title;
      }
    }

    switch (error.status) {
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested item was not found.';
      case 409:
        return 'That conflicts with an existing record.';
      default:
        return error.message || 'Something went wrong. Please try again.';
    }
  }
}
