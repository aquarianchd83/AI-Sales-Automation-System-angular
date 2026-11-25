import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { SaveSimulatorDummyRecordRequest, SimulatorDummyData, SimulatorDummyRecord } from '../models/simulator-data.model';

/** The Simulator dummy data page (PlatformSuperAdmin only, enforced by the API): what every simulator uses. */
@Injectable({ providedIn: 'root' })
export class SimulatorDataService {
  private readonly baseUrl = `${environment.apiBaseUrl}/platform/simulator-data`;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<SimulatorDummyData> {
    return this.http.get<SimulatorDummyData>(this.baseUrl);
  }

  create(request: SaveSimulatorDummyRecordRequest): Observable<SimulatorDummyRecord> {
    return this.http.post<SimulatorDummyRecord>(this.baseUrl, request);
  }

  update(id: string, request: SaveSimulatorDummyRecordRequest): Observable<SimulatorDummyRecord> {
    return this.http.put<SimulatorDummyRecord>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  restoreDefaults(): Observable<{ added: number }> {
    return this.http.post<{ added: number }>(`${this.baseUrl}/restore-defaults`, {});
  }
}
