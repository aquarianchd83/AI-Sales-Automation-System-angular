import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Booking, BookingFilter, BookingStatus } from '../models/booking.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

/** The demos, visits and appointments customers agreed with the AI. The dashboard tile reads totalCount of a one-row page. */
@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly baseUrl = `${environment.apiBaseUrl}/bookings`;

  constructor(private readonly http: HttpClient) {}

  /** Newest first. Test chat bookings are left out unless asked for. */
  getPaged(query: PagedQuery, filter: BookingFilter = {}): Observable<PagedResult<Booking>> {
    return this.http.get<PagedResult<Booking>>(this.baseUrl, {
      params: {
        ...toPagedParams(query),
        ...(filter.includeTests ? { IncludeTests: 'true' } : {}),
        ...(filter.status ? { Status: filter.status } : {}),
        ...(filter.outstanding ? { Outstanding: 'true' } : {}),
      },
    });
  }

  /** Pending, Done or Reschedule. With Reschedule, `newSlotLocal` is the new time as the tenant's clock reads it ("2026-11-04T11:00"); the API reads it in the tenant's zone. */
  setStatus(id: string, status: BookingStatus, newSlotLocal?: string | null): Observable<Booking> {
    return this.http.put<Booking>(`${this.baseUrl}/${id}/status`, { status, ...(newSlotLocal ? { newSlotLocal } : {}) });
  }
}
