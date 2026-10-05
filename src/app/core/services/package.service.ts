import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';
import { PackageSummary, SalesPackage, SavePackageRequest } from '../models/package.model';

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
}
