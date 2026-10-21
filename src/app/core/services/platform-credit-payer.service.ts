import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AdjustPlatformWalletRequest,
  CreditScenario,
  CreditScenarioInfo,
  CreditUsage,
  CreditUsageQuery,
  PlatformCreditEntry,
  PlatformCreditWallet,
  UpdateCreditPayerRequest,
} from '../models/credit-payer.model';
import { QuotaType } from '../models/billing.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

/** The Credit Payers screen's API: who pays for each credit scenario, the platform wallet, and who paid for each spend. */
@Injectable({ providedIn: 'root' })
export class PlatformCreditPayerService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/credit-payers`;

  constructor(private readonly http: HttpClient) {}

  getScenarios(): Observable<CreditScenarioInfo[]> {
    return this.http.get<CreditScenarioInfo[]>(`${this.baseUrl}/scenarios`);
  }

  setPayer(scenario: CreditScenario, request: UpdateCreditPayerRequest): Observable<CreditScenarioInfo> {
    return this.http.put<CreditScenarioInfo>(`${this.baseUrl}/scenarios/${scenario}`, request);
  }

  getWallets(): Observable<PlatformCreditWallet[]> {
    return this.http.get<PlatformCreditWallet[]>(`${this.baseUrl}/wallet`);
  }

  adjustWallet(request: AdjustPlatformWalletRequest): Observable<PlatformCreditWallet[]> {
    return this.http.post<PlatformCreditWallet[]>(`${this.baseUrl}/wallet/adjust`, request);
  }

  getWalletLedger(query: PagedQuery & { quotaType?: QuotaType | null }): Observable<PagedResult<PlatformCreditEntry>> {
    let params = new HttpParams({ fromObject: toPagedParams(query) });
    if (query.quotaType != null) {
      params = params.set('QuotaType', String(query.quotaType));
    }
    return this.http.get<PagedResult<PlatformCreditEntry>>(`${this.baseUrl}/wallet/ledger`, { params });
  }

  getUsage(query: CreditUsageQuery): Observable<PagedResult<CreditUsage>> {
    let params = new HttpParams({ fromObject: toPagedParams(query) });
    if (query.scenario != null) params = params.set('Scenario', String(query.scenario));
    if (query.chargedTo != null) params = params.set('ChargedTo', String(query.chargedTo));
    if (query.status != null) params = params.set('Status', String(query.status));
    if (query.fellBackToTenant != null) params = params.set('FellBackToTenant', String(query.fellBackToTenant));
    if (query.tenantId) params = params.set('TenantId', query.tenantId);
    return this.http.get<PagedResult<CreditUsage>>(`${this.baseUrl}/usage`, { params });
  }

  redeem(usageId: string, note: string): Observable<CreditUsage> {
    return this.http.post<CreditUsage>(`${this.baseUrl}/usage/${usageId}/redeem`, { note });
  }
}
