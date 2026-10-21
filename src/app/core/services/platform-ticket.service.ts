import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PlatformTicket, PlatformTicketStatus } from '../models/platform.model';

/** The product owner's tickets (`/platform/tickets`) - raised by the system, e.g. when a tenant meets a Simulated AI provider. */
@Injectable({ providedIn: 'root' })
export class PlatformTicketService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/tickets`;

  constructor(private readonly http: HttpClient) {}

  getAll(status?: PlatformTicketStatus): Observable<PlatformTicket[]> {
    return this.http.get<PlatformTicket[]>(this.baseUrl, { params: status ? { status } : {} });
  }

  setStatus(id: string, status: PlatformTicketStatus): Observable<PlatformTicket> {
    return this.http.put<PlatformTicket>(`${this.baseUrl}/${id}/status`, { status });
  }
}
