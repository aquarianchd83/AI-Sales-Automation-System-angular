import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/** One SMS the simulated provider "sent". `path` is the consent link's own path (/consent/<token>), openable on whatever address the app is on. */
export interface DemoSms {
  sentAtUtc: string;
  to: string;
  body: string;
  link: string | null;
  path: string | null;
}

/** Demo only. The API answers 404 unless the demo outbox is switched on (ConsentPage:DemoOutboxEnabled). */
@Injectable({ providedIn: 'root' })
export class DemoSmsOutboxService {
  constructor(private readonly http: HttpClient) {}

  list(): Observable<DemoSms[]> {
    return this.http.get<DemoSms[]>(`${environment.apiBaseUrl}/demo/sms-outbox`);
  }
}
