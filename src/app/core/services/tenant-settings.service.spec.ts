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

  it('gets and saves the WhatsApp config', () => {
    service.getWhatsAppConfig().subscribe();
    http.expectOne({ url: baseUrl + '/whatsapp', method: 'GET' }).flush(null);

    service
      .saveWhatsAppConfig({ phoneNumberId: '123', whatsAppBusinessAccountId: '456' })
      .subscribe();
    const putRequest = http.expectOne({ url: baseUrl + '/whatsapp', method: 'PUT' });
    expect(putRequest.request.body).toEqual({ phoneNumberId: '123', whatsAppBusinessAccountId: '456' });
    putRequest.flush({
      phoneNumberId: '123',
      whatsAppBusinessAccountId: '456',
      hasAccessToken: false,
      hasAppSecret: false,
      apiVersion: 'v19.0',
      apiBaseUrl: 'https://graph.facebook.com/',
      isConnected: false,
    });
  });

  it('gets and saves the AI config', () => {
    service.getAiConfig().subscribe();
    http.expectOne({ url: baseUrl + '/ai', method: 'GET' }).flush(null);

    service.saveAiConfig({ provider: 'OpenAI' }).subscribe();
    const putRequest = http.expectOne({ url: baseUrl + '/ai', method: 'PUT' });
    expect(putRequest.request.body).toEqual({ provider: 'OpenAI' });
    putRequest.flush({
      provider: 'OpenAI',
      embeddingProvider: 'Simulated',
      hasAnthropicApiKey: false,
      anthropicModel: 'claude-haiku-4-5-20251001',
      hasOpenAiApiKey: true,
      openAiChatModel: 'gpt-5-nano',
      openAiEmbeddingModel: 'text-embedding-3-small',
      hasGoogleApiKey: false,
      googleChatModel: 'gemini-flash-lite-latest',
      googleEmbeddingModel: 'text-embedding-004',
    });
  });
});
