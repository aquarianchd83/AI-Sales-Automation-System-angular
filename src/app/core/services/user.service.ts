import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { PagedQuery, PagedResult, toPagedParams } from '../models/paged-result.model';
import { PLATFORM_ADMIN_ROLES } from '../models/platform.model';
import {
  AssignRolesRequest,
  CreateUserRequest,
  Role,
  UpdateUserRequest,
  User,
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;
  private readonly rolesUrl = `${environment.apiBaseUrl}/roles`;

  constructor(private readonly http: HttpClient) {}

  getPaged(query: PagedQuery): Observable<PagedResult<User>> {
    return this.http.get<PagedResult<User>>(this.baseUrl, {
      params: toPagedParams(query),
    });
  }

  getById(id: string): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.baseUrl, request);
  }

  update(id: string, request: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  assignRoles(id: string, roles: string[]): Observable<User> {
    return this.http.put<User>(`${this.baseUrl}/${id}/roles`, {
      roles,
    } as AssignRolesRequest);
  }

  /** Returns role names as plain strings — only the ones a tenant admin can assign. GET /roles also
   * lists PlatformSuperAdmin, which belongs to no tenant and must never be offered on a tenant's own
   * Users screen (see AppRole.PlatformSuperAdmin). Filtered by exclusion rather than against
   * TENANT_ROLES so a new tenant role the backend seeds later still shows up without a frontend change. */
  getRoles(): Observable<Role[]> {
    return this.http
      .get<Role[]>(this.rolesUrl)
      .pipe(map((roles) => roles.filter((role) => !PLATFORM_ADMIN_ROLES.includes(role))));
  }
}
