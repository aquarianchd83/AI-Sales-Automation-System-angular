import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  AddCustomerTagsRequest,
  BulkDeleteCustomersRequest,
  BulkDeleteCustomersResult,
  CreateCustomerRequest,
  Customer,
  CustomerImportResult,
  OptInCustomerRequest,
  UpdateCustomerRequest,
} from '../models/customer.model';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly baseUrl = `${environment.apiBaseUrl}/customers`;

  constructor(private readonly http: HttpClient) {}

  /** The API supports Page/PageSize/Search only — no sorting or field filters. */
  getPaged(query: PagedQuery): Observable<PagedResult<Customer>> {
    return this.http.get<PagedResult<Customer>>(this.baseUrl, {
      params: toPagedParams(query),
    });
  }

  getById(id: string): Observable<Customer> {
    return this.http.get<Customer>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateCustomerRequest): Observable<Customer> {
    return this.http.post<Customer>(this.baseUrl, request);
  }

  update(id: string, request: UpdateCustomerRequest): Observable<Customer> {
    return this.http.put<Customer>(`${this.baseUrl}/${id}`, request);
  }

  /** Soft-delete (backend sets IsDeleted + global query filter hides the row). */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Soft-deletes many customers in one request. The API dedupes the ids, caps them at
   * BULK_DELETE_MAX_IDS, and is idempotent: ids that are already deleted or unknown come
   * back in `notFoundIds` rather than failing the whole call.
   */
  bulkDelete(ids: string[]): Observable<BulkDeleteCustomersResult> {
    return this.http.post<BulkDeleteCustomersResult>(`${this.baseUrl}/bulk-delete`, {
      ids,
    } as BulkDeleteCustomersRequest);
  }

  /**
   * Adds tags. There is no remove-tag endpoint in this API version, so callers must
   * not present tag removal as if it were persisted.
   */
  addTags(id: string, tagNames: string[]): Observable<Customer> {
    return this.http.post<Customer>(`${this.baseUrl}/${id}/tags`, {
      tagNames,
    } as AddCustomerTagsRequest);
  }

  /**
   * Records consent. Idempotent — calling it on an already opted-in customer returns the
   * record unchanged rather than overwriting the original consent timestamp.
   */
  optIn(id: string, request: OptInCustomerRequest): Observable<Customer> {
    return this.http.post<Customer>(`${this.baseUrl}/${id}/opt-in`, request);
  }

  /** The endpoint takes no request body. */
  optOut(id: string): Observable<Customer> {
    return this.http.post<Customer>(`${this.baseUrl}/${id}/opt-out`, null);
  }

  /**
   * Uploads a CSV or .xlsx as multipart/form-data under the field name `file`.
   * Emits HttpEvents so the UI can show upload progress.
   */
  import(file: File): Observable<HttpEvent<CustomerImportResult>> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<CustomerImportResult>(`${this.baseUrl}/import`, form, {
      reportProgress: true,
      observe: 'events',
    });
  }
}
