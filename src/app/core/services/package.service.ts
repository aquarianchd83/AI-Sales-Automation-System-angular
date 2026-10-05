import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';
import {
  PackageSale,
  PackageSummary,
  RecordPackageSaleRequest,
  SalesPackage,
  SavePackageRequest,
} from '../models/package.model';

@Injectable({ providedIn: 'root' })
export class PackageService {
  private readonly baseUrl = `${environment.apiBaseUrl}/packages`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PagedQuery): Observable<PagedResult<SalesPackage>> {
    return this.http.get<PagedResult<SalesPackage>>(this.baseUrl, { params: toPagedParams(query) });
  }

  /** Totals over active packages only — drives the revenue cards above the list. */
  getSummary(): Observable<PackageSummary> {
    return this.http.get<PackageSummary>(`${this.baseUrl}/summary`);
  }

  create(request: SavePackageRequest): Observable<SalesPackage> {
    return this.http.post<SalesPackage>(this.baseUrl, request);
  }

  update(id: string, request: SavePackageRequest): Observable<SalesPackage> {
    return this.http.put<SalesPackage>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /** Recent sales, newest first. */
  getSales(query: PagedQuery): Observable<PagedResult<PackageSale>> {
    return this.http.get<PagedResult<PackageSale>>(`${this.baseUrl}/sales`, { params: toPagedParams(query) });
  }

  /** Records that a customer bought a package — the data the Revenue report is built from. */
  recordSale(request: RecordPackageSaleRequest): Observable<PackageSale> {
    return this.http.post<PackageSale>(`${this.baseUrl}/sales`, request);
  }

  deleteSale(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/sales/${id}`);
  }
}
