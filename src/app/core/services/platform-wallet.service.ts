import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';
import { AddWalletTopUpRequest, PlatformWalletSummary, WalletTopUp } from '../models/platform-wallet.model';

/**
 * The platform admin's wallet: money loaded into the AI providers, one balance with every top-up kept as history. The latest summary is held here so
 * the top bar and the history page show the same figure, and adding a top-up refreshes it.
 */
@Injectable({ providedIn: 'root' })
export class PlatformWalletService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/wallet`;
  private readonly summary = new BehaviorSubject<PlatformWalletSummary | null>(null);

  /** The latest balance, or null until it has been read. */
  readonly summary$ = this.summary.asObservable();

  constructor(private readonly http: HttpClient) {}

  /** Reads the balance again. A failure leaves the last known figure in place. */
  refresh(): void {
    this.http.get<PlatformWalletSummary>(`${this.baseUrl}/summary`).subscribe({
      next: (summary) => this.summary.next(summary),
      error: () => undefined,
    });
  }

  getTopUps(query: PagedQuery): Observable<PagedResult<WalletTopUp>> {
    return this.http.get<PagedResult<WalletTopUp>>(`${this.baseUrl}/top-ups`, { params: toPagedParams(query) });
  }

  addTopUp(request: AddWalletTopUpRequest): Observable<WalletTopUp> {
    return this.http.post<WalletTopUp>(`${this.baseUrl}/top-ups`, request).pipe(tap(() => this.refresh()));
  }
}
