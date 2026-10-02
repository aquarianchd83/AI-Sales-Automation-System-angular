import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { environment } from '../../../../environments/environment';
import { MediaAsset } from '../../../core/models/media.model';
import { SharedModule } from '../../../shared/shared.module';
import { MediaDetailDialogComponent } from './media-detail-dialog.component';

describe('MediaDetailDialogComponent', () => {
  const asset: MediaAsset = {
    id: 'a1', fileName: 'old.png', contentType: 'image/png', sizeBytes: 10, url: 'https://bucket.s3.amazonaws.com/media/old.png',
    createdAt: '2026-10-02T00:00:00Z', isPublicUrl: true, previewUrl: 'https://bucket.s3.amazonaws.com/media/old.png',
  };
  let fixture: ComponentFixture<MediaDetailDialogComponent>;
  let http: HttpTestingController;
  const close = jasmine.createSpy('close');

  beforeEach(() => {
    close.calls.reset();
    TestBed.configureTestingModule({
      declarations: [MediaDetailDialogComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: asset },
        { provide: MatDialogRef, useValue: { close } },
      ],
    });
    fixture = TestBed.createComponent(MediaDetailDialogComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  function pick(file: File): void {
    fixture.componentInstance.onFileChosen({ target: { files: [file], value: '' } } as unknown as Event);
    fixture.detectChanges();
  }

  it('previews a chosen replacement before anything is sent', () => {
    pick(new File([new Uint8Array(4)], 'new.jpg', { type: 'image/jpeg' }));

    expect(fixture.componentInstance.pending?.name).toBe('new.jpg');
    expect(fixture.nativeElement.querySelector('.replace-pending img')).toBeTruthy();
    http.expectNone(`${environment.apiBaseUrl}/media/a1/replace`);
  });

  it('refuses a replacement of a type that is not allowed', () => {
    pick(new File([new Uint8Array(4)], 'x.exe', { type: 'application/x-msdownload' }));

    expect(fixture.componentInstance.pending).toBeNull();
    expect(fixture.componentInstance.pendingError).toContain('not allowed');
  });

  it('replaces the file, shows the new one and tells the list to reload on close', () => {
    pick(new File([new Uint8Array(4)], 'new.jpg', { type: 'image/jpeg' }));

    fixture.componentInstance.confirmReplace();
    const req = http.expectOne(`${environment.apiBaseUrl}/media/a1/replace`);
    expect(req.request.method).toBe('POST');
    req.flush({ ...asset, fileName: 'new.jpg', contentType: 'image/jpeg' });

    expect(fixture.componentInstance.asset.fileName).toBe('new.jpg');
    expect(fixture.componentInstance.pending).toBeNull();
    fixture.componentInstance.close();
    expect(close).toHaveBeenCalledWith('changed');
  });
});
