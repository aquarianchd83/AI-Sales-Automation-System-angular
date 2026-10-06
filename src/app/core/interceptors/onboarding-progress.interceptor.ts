import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, Injector } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { OnboardingService } from '../services/onboarding.service';

const READS = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Tells onboarding that something was saved, so a step completed inside the wizard's panel (a package created, a
 * WhatsApp connection verified, ...) ticks off without the tenant pressing anything. Only successful writes count,
 * and never onboarding's own call or sign-in traffic. OnboardingService is looked up lazily: it uses HttpClient,
 * which is built from these interceptors.
 */
@Injectable()
export class OnboardingProgressInterceptor implements HttpInterceptor {
  constructor(private readonly injector: Injector) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (READS.includes(request.method) || /\/(onboarding|auth)(\/|\?|$)/.test(request.url)) {
      return next.handle(request);
    }
    return next.handle(request).pipe(
      tap((event) => {
        if (event instanceof HttpResponse) {
          this.injector.get(OnboardingService).noteChange();
        }
      })
    );
  }
}
