import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MediaService } from './media.service';
import { environment } from '../../../environments/environment';

describe('MediaService', () => {
  let service: MediaService;
  let http: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/media`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(MediaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uploads as multipart form data under the field name "file"', () => {
    const file = new File(['binary'], 'photo.jpg', { type: 'image/jpeg' });
    service.upload(file).subscribe();

    const req = http.expectOne(`${baseUrl}/upload`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body instanceof FormData).toBeTrue();
    expect((body.get('file') as File).name).toBe('photo.jpg');
    expect(req.request.reportProgress).toBeTrue();
    req.flush({
      id: '1',
      fileName: 'photo.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 6,
      url: '/media/1',
      createdAt: '',
    });
  });

  it('defaults delete to force=false', () => {
    service.delete('asset-1').subscribe();

    const req = http.expectOne((r) => r.url === `${baseUrl}/asset-1`);
    expect(req.request.params.get('force')).toBe('false');
    req.flush(null);
  });

  it('sends force=true when asked to force-delete', () => {
    service.delete('asset-1', true).subscribe();

    const req = http.expectOne((r) => r.url === `${baseUrl}/asset-1`);
    expect(req.request.params.get('force')).toBe('true');
    req.flush(null);
  });
});
