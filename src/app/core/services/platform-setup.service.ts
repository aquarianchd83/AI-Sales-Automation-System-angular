import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  PlanSetupSummary,
  SaveRequirementRequest,
  SaveSetupVersionRequest,
  SetupDefinition,
  SetupField,
  SetupVersionDetail,
} from '../models/application-setup.model';

/** Platform Admin Console: what each plan asks a tenant to set up - versioned, editable without a release. */
@Injectable({ providedIn: 'root' })
export class PlatformSetupService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/setup`;

  constructor(private readonly http: HttpClient) {}

  getPlans(): Observable<PlanSetupSummary[]> {
    return this.http.get<PlanSetupSummary[]>(`${this.baseUrl}/plans`);
  }

  /** Starts the next draft, copying the latest published version (or `cloneFromVersionId`). */
  createVersion(planId: string, releaseNotes?: string | null, cloneFromVersionId?: string | null): Observable<SetupVersionDetail> {
    return this.http.post<SetupVersionDetail>(`${this.baseUrl}/plans/${planId}/versions`, {
      cloneFromVersionId: cloneFromVersionId || null,
      releaseNotes: releaseNotes || null,
    });
  }

  getVersion(versionId: string): Observable<SetupVersionDetail> {
    return this.http.get<SetupVersionDetail>(`${this.baseUrl}/versions/${versionId}`);
  }

  /** Exactly what a Talent would see for the version — active fields only. Nothing is saved. */
  preview(versionId: string): Observable<SetupDefinition> {
    return this.http.get<SetupDefinition>(`${this.baseUrl}/versions/${versionId}/preview`);
  }

  updateVersion(versionId: string, request: SaveSetupVersionRequest): Observable<SetupVersionDetail> {
    return this.http.put<SetupVersionDetail>(`${this.baseUrl}/versions/${versionId}`, request);
  }

  publish(versionId: string): Observable<SetupVersionDetail> {
    return this.http.post<SetupVersionDetail>(`${this.baseUrl}/versions/${versionId}/publish`, {});
  }

  deleteVersion(versionId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/versions/${versionId}`);
  }

  addRequirement(versionId: string, request: SaveRequirementRequest): Observable<SetupField> {
    return this.http.post<SetupField>(`${this.baseUrl}/versions/${versionId}/requirements`, request);
  }

  updateRequirement(requirementId: string, request: SaveRequirementRequest): Observable<SetupField> {
    return this.http.put<SetupField>(`${this.baseUrl}/requirements/${requirementId}`, request);
  }

  deleteRequirement(requirementId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/requirements/${requirementId}`);
  }
}
