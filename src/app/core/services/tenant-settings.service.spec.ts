import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { TenantSettingsService } from './tenant-settings.service';
import { environment } from '../../../environments/environment';

describe('TenantSettingsService', () => {
  let service: TenantSettingsService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/tenant-settings`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(TenantSettingsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the WhatsApp config', () => {
    service.getWhatsAppConfig().subscribe();
    http.expectOne({ url: baseUrl + '/whatsapp', method: 'GET' }).flush(null);
  });

  it('gets the AI config', () => {
    service.getAiConfig().subscribe();
    http.expectOne({ url: baseUrl + '/ai', method: 'GET' }).flush(null);
  });
});
