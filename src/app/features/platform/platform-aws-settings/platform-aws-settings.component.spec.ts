import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { AwsConnectionTestResult, PlatformAwsSettings } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformAwsSettingsService } from '../../../core/services/platform-aws-settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformAwsSettingsComponent } from './platform-aws-settings.component';

const stored = (over: Partial<PlatformAwsSettings> = {}): PlatformAwsSettings => ({
  storageProvider: 'S3',
  bucketName: 'plat-media',
  region: 'ap-southeast-2',
  keyPrefix: 'media',
  publicBaseUrl: '',
  hasAccessKeyId: true,
  accessKeyIdHint: '••••1234',
  hasSecretAccessKey: true,
  secretAccessKeyHint: '••••9876',
  isConfigured: true,
  ...over,
});

describe('PlatformAwsSettingsComponent', () => {
  let service: jasmine.SpyObj<PlatformAwsSettingsService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const create = (settings: PlatformAwsSettings) => {
    service = jasmine.createSpyObj('PlatformAwsSettingsService', ['get', 'save', 'testConnection']);
    service.get.and.returnValue(of(settings));
    service.save.and.callFake(() => of(settings));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);

    TestBed.configureTestingModule({
      declarations: [PlatformAwsSettingsComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformAwsSettingsService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const fixture = TestBed.createComponent(PlatformAwsSettingsComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('shows the stored settings and only a hint of the credentials', () => {
    const fixture = create(stored());
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(fixture.componentInstance.form.getRawValue().bucketName).toBe('plat-media');
    expect(fixture.componentInstance.form.getRawValue().accessKeyId).toBe('');
    expect(text).toContain('Stored: ••••1234');
    expect(text).toContain('s3://plat-media');
  });

  it('keeps the stored credentials (sends null) when the fields are left blank', () => {
    const fixture = create(stored());
    fixture.componentInstance.form.controls.bucketName.setValue('other-bucket');
    fixture.componentInstance.form.markAsDirty();

    fixture.componentInstance.save();

    expect(service.save).toHaveBeenCalledWith(
      jasmine.objectContaining({ bucketName: 'other-bucket', accessKeyId: null, secretAccessKey: null })
    );
  });

  it('sends the typed credentials to replace the stored ones', () => {
    const fixture = create(stored());
    fixture.componentInstance.form.patchValue({ accessKeyId: ' AKIANEW ', secretAccessKey: 'newsecret' });
    fixture.componentInstance.form.markAsDirty();

    fixture.componentInstance.save();

    expect(service.save).toHaveBeenCalledWith(jasmine.objectContaining({ accessKeyId: 'AKIANEW', secretAccessKey: 'newsecret' }));
  });

  it('clears both credentials when "remove the stored keys" is ticked', () => {
    const fixture = create(stored());
    fixture.componentInstance.form.patchValue({ removeKeys: true });
    fixture.componentInstance.form.markAsDirty();

    fixture.componentInstance.save();

    expect(service.save).toHaveBeenCalledWith(jasmine.objectContaining({ accessKeyId: '', secretAccessKey: '' }));
  });

  it('refuses to switch to S3 without a bucket and region', () => {
    const fixture = create(stored({ storageProvider: 'Local', bucketName: '', region: '', isConfigured: false, hasAccessKeyId: false, hasSecretAccessKey: false }));
    fixture.componentInstance.form.patchValue({ storageProvider: 'S3' });
    fixture.componentInstance.form.markAsDirty();

    fixture.componentInstance.save();

    expect(service.save).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalled();
  });

  it('refuses a half-entered credential pair when none is stored', () => {
    const fixture = create(stored({ hasAccessKeyId: false, hasSecretAccessKey: false, accessKeyIdHint: null, secretAccessKeyHint: null }));
    fixture.componentInstance.form.patchValue({ accessKeyId: 'AKIANEW' });
    fixture.componentInstance.form.markAsDirty();

    fixture.componentInstance.save();

    expect(service.save).not.toHaveBeenCalled();
  });

  it('says the server role is used when no keys are stored', () => {
    const fixture = create(stored({ hasAccessKeyId: false, hasSecretAccessKey: false, accessKeyIdHint: null, secretAccessKeyHint: null }));

    expect(fixture.componentInstance.willUseServerRole).toBeTrue();
  });

  describe('test connection', () => {
    const ok: AwsConnectionTestResult = {
      success: true,
      message: 'Connected to plat-media (ap-southeast-2): media can be written, read and deleted.',
      steps: [
        { name: 'Write', passed: true, detail: 'Wrote media/_connection-test/x.txt' },
        { name: 'Read', passed: true, detail: 'Read the test file back' },
        { name: 'Delete', passed: true, detail: 'Removed the test file' },
      ],
    };

    it('tests what is on screen without saving, using the stored keys when the fields are blank', () => {
      const fixture = create(stored());
      service.testConnection.and.returnValue(of(ok));
      fixture.componentInstance.form.controls.bucketName.setValue('other-bucket');

      fixture.componentInstance.testConnection();
      fixture.detectChanges();

      expect(service.testConnection).toHaveBeenCalledWith(
        jasmine.objectContaining({ bucketName: 'other-bucket', accessKeyId: null, secretAccessKey: null })
      );
      expect(service.save).not.toHaveBeenCalled();
      const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
      expect(text).toContain('media can be written, read and deleted');
      expect(text).toContain('Removed the test file');
    });

    it('shows a failing step and clears the result once the form changes', () => {
      const fixture = create(stored());
      service.testConnection.and.returnValue(
        of({ success: false, message: 'The connection works only in part.', steps: [{ name: 'Write', passed: false, detail: 'The access key ID or secret access key is wrong.' }] })
      );

      fixture.componentInstance.testConnection();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('secret access key is wrong');

      fixture.componentInstance.form.controls.region.setValue('us-east-1');
      fixture.detectChanges();
      expect(fixture.componentInstance.testResult).toBeNull();
    });

    it('will not test without a bucket and region', () => {
      const fixture = create(stored({ bucketName: '', region: '', isConfigured: false }));

      fixture.componentInstance.testConnection();

      expect(service.testConnection).not.toHaveBeenCalled();
      expect(notify.error).toHaveBeenCalled();
    });
  });
});
