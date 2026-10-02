import { Component, OnInit } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { PlatformAwsSettings } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformAwsSettingsService } from '../../../core/services/platform-aws-settings.service';

const BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;
const REGION_CODE = /^[a-z]{2}(-[a-z]+)+-[0-9]$/;

/**
 * The Platform Admin Console's AWS Settings page: the S3 bucket every tenant's media is stored in, and the AWS credentials
 * for it. Saved to the database only - appsettings.json holds none of it - with the access key and secret encrypted at rest
 * and never shown again: a blank credential field keeps the stored one, and "Remove stored keys" clears both so the
 * server's own AWS role is used.
 */
@Component({
  selector: 'app-platform-aws-settings',
  templateUrl: './platform-aws-settings.component.html',
  styleUrls: ['./platform-aws-settings.component.scss'],
})
export class PlatformAwsSettingsComponent implements OnInit {
  readonly providers = [
    { value: 'Local', label: "Local disk (this server)" },
    { value: 'S3', label: 'Amazon S3 (the platform bucket)' },
  ];

  readonly form = this.fb.group({
    storageProvider: 'Local',
    bucketName: ['', [Validators.pattern(BUCKET_NAME)]],
    region: ['', [Validators.pattern(REGION_CODE)]],
    keyPrefix: 'media',
    publicBaseUrl: ['', [Validators.pattern(/^https?:\/\/\S+$/i)]],
    accessKeyId: '',
    secretAccessKey: '',
    removeKeys: false,
  });

  current: PlatformAwsSettings | null = null;
  loading = true;
  loadFailed = false;
  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly aws: PlatformAwsSettingsService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get usesS3(): boolean {
    return this.form.controls.storageProvider.value === 'S3';
  }

  /** What the page can tell the operator about a stored credential: its last four characters, never the value. */
  storedHint(kind: 'accessKeyId' | 'secretAccessKey'): string | null {
    if (!this.current) {
      return null;
    }
    const has = kind === 'accessKeyId' ? this.current.hasAccessKeyId : this.current.hasSecretAccessKey;
    const hint = kind === 'accessKeyId' ? this.current.accessKeyIdHint : this.current.secretAccessKeyHint;
    return has ? hint ?? 'set' : null;
  }

  /** True when the credentials will be left unset on save, so the server's own AWS role (or default profile) is used. */
  get willUseServerRole(): boolean {
    const raw = this.form.getRawValue();
    if (raw.removeKeys) {
      return true;
    }
    return !this.current?.hasAccessKeyId && !raw.accessKeyId.trim() && !raw.secretAccessKey.trim();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.aws
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (settings) => this.apply(settings),
        error: () => (this.loadFailed = true),
      });
  }

  save(): void {
    if (this.saving || this.form.pristine) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    if (raw.storageProvider === 'S3' && (!raw.bucketName.trim() || !raw.region.trim())) {
      this.notify.error('A bucket name and region are required before new uploads can go to S3.');
      return;
    }

    // Credentials: untouched (blank) = null = keep what is stored; "Remove stored keys" = '' = clear both.
    const accessKeyId = raw.removeKeys ? '' : raw.accessKeyId.trim() || null;
    const secretAccessKey = raw.removeKeys ? '' : raw.secretAccessKey.trim() || null;
    if (!raw.removeKeys && (accessKeyId === null) !== (secretAccessKey === null) && !this.current?.hasAccessKeyId) {
      this.notify.error('Enter both the access key ID and the secret access key, or leave both blank.');
      return;
    }

    this.saving = true;
    this.aws
      .save({
        storageProvider: raw.storageProvider,
        bucketName: raw.bucketName.trim(),
        region: raw.region.trim(),
        keyPrefix: raw.keyPrefix.trim(),
        publicBaseUrl: raw.publicBaseUrl.trim(),
        accessKeyId,
        secretAccessKey,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (settings) => {
          this.notify.success('AWS settings saved. They apply from the next request - no restart needed.');
          this.apply(settings);
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  private apply(settings: PlatformAwsSettings): void {
    this.current = settings;
    this.form.reset({
      storageProvider: settings.storageProvider,
      bucketName: settings.bucketName,
      region: settings.region,
      keyPrefix: settings.keyPrefix || 'media',
      publicBaseUrl: settings.publicBaseUrl,
      accessKeyId: '',
      secretAccessKey: '',
      removeKeys: false,
    });
  }
}
