import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { environment } from '../../../../environments/environment';
import { SharedModule } from '../../../shared/shared.module';
import { MediaUploadDialogComponent } from './media-upload-dialog.component';

describe('MediaUploadDialogComponent', () => {
  let fixture: ComponentFixture<MediaUploadDialogComponent>;
  let http: HttpTestingController;
  const close = jasmine.createSpy('close');

  beforeEach(() => {
    close.calls.reset();
    TestBed.configureTestingModule({
      declarations: [MediaUploadDialogComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
      providers: [{ provide: MatDialogRef, useValue: { close } }],
    });
    fixture = TestBed.createComponent(MediaUploadDialogComponent);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  it('cannot add by link until the link looks like a web address', () => {
    const c = fixture.componentInstance;
    c.mode = 'link';

    c.urlControl.setValue('logo.png');
    expect(c.canSubmit).toBeFalse();

    c.urlControl.setValue('https://yourdomain.com/assets/logo.png');
    expect(c.canSubmit).toBeTrue();
  });

  it('posts the link and closes with the new asset', () => {
    const c = fixture.componentInstance;
    c.mode = 'link';
    c.urlControl.setValue(' https://yourdomain.com/assets/logo.png ');

    c.submit();

    const req = http.expectOne(`${environment.apiBaseUrl}/media/from-url`);
    expect(req.request.body).toEqual({ url: 'https://yourdomain.com/assets/logo.png' });
    const asset = { id: 'a1', url: 'https://yourdomain.com/assets/logo.png' };
    req.flush(asset);
    expect(close).toHaveBeenCalledWith(asset as any);
  });
});
