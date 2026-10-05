import { Component, ElementRef, Inject, OnInit, ViewChild } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { environment } from '../../../../environments/environment';
import { MediaAsset, mediaThumbnailUrl } from '../../../core/models/media.model';
import {
  PLATFORM_TEMPLATE_MAX_BODY,
  PLATFORM_TEMPLATE_TOKENS,
  PLATFORM_TEMPLATE_TOKEN_HELP,
  PlatformMessageTemplate,
  PlatformTemplateToken,
  renderTemplatePreview,
  startsOrEndsWithToken,
  unknownTemplateTokens,
} from '../../../core/models/platform-whatsapp.model';
import { PlatformMediaService } from '../../../core/services/platform-media.service';
import { PlatformMessageTemplatesService } from '../../../core/services/platform-message-templates.service';
import { TemplateHeaderKind, isUsableTemplateHeader, templateHeaderKind } from '../../../core/models/message-template.model';

export interface PlatformTemplateEditData {
  template: PlatformMessageTemplate;
}

/** The body rules the server enforces too: only the tokens a notice can fill, and not starting or ending with one (Meta refuses that). */
export function templateBodyValidator(control: AbstractControl<string>): ValidationErrors | null {
  const body = control.value ?? '';
  if (!body.trim()) {
    return null; // `required` reports that.
  }
  const unknown = unknownTemplateTokens(body);
  if (unknown.length) {
    return { unknownTokens: unknown };
  }
  return startsOrEndsWithToken(body) ? { edgeToken: true } : null;
}

@Component({
  selector: 'app-platform-template-edit-dialog',
  templateUrl: './platform-template-edit-dialog.component.html',
  styleUrls: ['./platform-template-edit-dialog.component.scss'],
})
export class PlatformTemplateEditDialogComponent implements OnInit {
  @ViewChild('bodyInput') bodyInput?: ElementRef<HTMLTextAreaElement>;

  readonly tokens = PLATFORM_TEMPLATE_TOKENS;
  readonly tokenHelp = PLATFORM_TEMPLATE_TOKEN_HELP;
  readonly maxBody = PLATFORM_TEMPLATE_MAX_BODY;
  readonly template = this.data.template;

  readonly form = this.fb.group({
    name: [this.data.template.name, [Validators.required, Validators.maxLength(200)]],
    bodyText: [this.data.template.bodyText, [Validators.required, Validators.maxLength(PLATFORM_TEMPLATE_MAX_BODY), templateBodyValidator]],
    isActive: this.data.template.isActive,
    /** '' = no image. */
    headerMediaAssetId: this.data.template.headerMediaAssetId ?? '',
  });

  images: MediaAsset[] = [];
  imagesLoading = true;
  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly api: PlatformMessageTemplatesService,
    private readonly media: PlatformMediaService,
    private readonly dialogRef: MatDialogRef<PlatformTemplateEditDialogComponent, PlatformMessageTemplate | undefined>,
    @Inject(MAT_DIALOG_DATA) private readonly data: PlatformTemplateEditData
  ) {}

  /** Meta fixes whether a template HAS an image header when it first creates it, so after that the image can be swapped but not added or removed. */
  get headerLocked(): boolean {
    return !!this.template.metaTemplateId && !this.template.headerMediaAssetId;
  }

  get headerRequired(): boolean {
    return !!this.template.metaTemplateId && this.template.headerOnMeta;
  }

  get preview(): string {
    return renderTemplatePreview(this.form.controls.bodyText.value, this.template.sampleMessage);
  }

  readonly thumb = (asset: MediaAsset): string | null => mediaThumbnailUrl(asset, environment.apiBaseUrl);

  readonly headerKind = (asset: MediaAsset): TemplateHeaderKind | null => templateHeaderKind(asset.contentType);

  /** On Meta, a template keeps the kind of header it was created with, so a swap must be the same kind. */
  lockedKind: TemplateHeaderKind | null = null;

  get previewImage(): MediaAsset | null {
    const id = this.form.controls.headerMediaAssetId.value;
    return this.images.find((i) => i.id === id) ?? null;
  }

  get bodyLength(): number {
    return this.form.controls.bodyText.value.length;
  }

  get unknownTokens(): string[] {
    return (this.form.controls.bodyText.errors?.['unknownTokens'] as string[] | undefined) ?? [];
  }

  ngOnInit(): void {
    this.media
      .getAll()
      .pipe(finalize(() => (this.imagesLoading = false)))
      .subscribe({
        next: (all) => {
          const current = all.find((a) => a.id === this.template.headerMediaAssetId);
          this.lockedKind = this.headerRequired && current ? templateHeaderKind(current.contentType) : null;
          this.images = all.filter((a) => this.usable(a) || a.id === this.template.headerMediaAssetId);
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  /** Meta accepts a JPEG or PNG up to 5 MB, or an MP4 or 3GPP video up to 16 MB - of the locked kind once on Meta. */
  usable(asset: MediaAsset): boolean {
    return isUsableTemplateHeader(asset) && (!this.lockedKind || templateHeaderKind(asset.contentType) === this.lockedKind);
  }

  /** Puts {{Token}} where the cursor is, replacing any selection. */
  insert(token: PlatformTemplateToken): void {
    const control = this.form.controls.bodyText;
    const textarea = this.bodyInput?.nativeElement;
    const text = `{{${token}}}`;
    const value = control.value;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? value.length;

    control.setValue(value.slice(0, start) + text + value.slice(end));
    control.markAsDirty();
    if (textarea) {
      const caret = start + text.length;
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(caret, caret);
      });
    }
  }

  restoreDefault(): void {
    this.form.controls.bodyText.setValue(this.template.defaultBodyText);
    this.form.controls.bodyText.markAsDirty();
  }

  save(): void {
    if (this.saving) {
      return;
    }
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }

    const raw = this.form.getRawValue();
    const had = this.template.headerMediaAssetId ?? '';
    this.saving = true;
    this.api
      .update(this.template.id, {
        name: raw.name.trim(),
        bodyText: raw.bodyText.trim(),
        isActive: raw.isActive,
        // null keeps the current image; a different id swaps it; none clears it.
        headerMediaAssetId: raw.headerMediaAssetId && raw.headerMediaAssetId !== had ? raw.headerMediaAssetId : null,
        removeHeaderImage: !raw.headerMediaAssetId && !!had,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (updated) => this.dialogRef.close(updated),
        error: () => {
          // ErrorInterceptor toasts it (a 409 explains what Meta does not allow).
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
