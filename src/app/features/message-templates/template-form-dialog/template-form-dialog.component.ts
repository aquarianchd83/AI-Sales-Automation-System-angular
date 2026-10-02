import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Observable, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap } from 'rxjs/operators';

import { KNOWN_PLACEHOLDER_TOKENS, placeholderTokenValidator } from '../../../core/utils/placeholder-tokens';
import {
  MessageTemplate,
  TEMPLATE_CATEGORIES,
  TEMPLATE_LANGUAGES,
  templateCategoryInfo,
  TEMPLATE_IMAGE_CONTENT_TYPES,
  TEMPLATE_IMAGE_MAX_BYTES,
  templateLanguageLabel,
  WhatsAppTemplateStatus,
} from '../../../core/models/message-template.model';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { MediaService } from '../../../core/services/media.service';
import { MediaAsset, formatFileSize, mediaPreviewUrl } from '../../../core/models/media.model';
import { environment } from '../../../../environments/environment';
import { NotificationService } from '../../../core/services/notification.service';

export interface TemplateFormDialogData {
  mode: 'create' | 'edit';
  template?: MessageTemplate;
}

@Component({
  selector: 'app-template-form-dialog',
  templateUrl: './template-form-dialog.component.html',
  styleUrls: ['./template-form-dialog.component.scss'],
})
export class TemplateFormDialogComponent implements OnInit {
  readonly isEdit = this.data.mode === 'edit';
  readonly categories = TEMPLATE_CATEGORIES;
  readonly languages = TEMPLATE_LANGUAGES;
  readonly languageLabel = templateLanguageLabel;
  readonly categoryInfo = templateCategoryInfo;
  readonly knownTokens = KNOWN_PLACEHOLDER_TOKENS;
  readonly bodyTextPlaceholderExample = 'Hi {{FirstName}}, your order is on its way.';

  /**
   * Language and category stay editable until the template has been created on Meta — Meta does
   * not allow changing either afterward, and the API rejects it too.
   */
  readonly canEditLanguageAndCategory = !this.isEdit || !this.data.template?.metaTemplateId;

  readonly form = this.fb.nonNullable.group({
    // Name and WhatsApp template name are immutable after creation, so those controls are only
    // shown in create mode. Language and category are also shown when editing a template that
    // has not been created on Meta yet — see canEditLanguageAndCategory.
    name: [this.data.template?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    language: [this.data.template?.language ?? 'en', [Validators.required, Validators.maxLength(10)]],
    category: [this.data.template?.category ?? this.categories[0], [Validators.required]],
    whatsAppTemplateName: [
      this.data.template?.whatsAppTemplateName ?? '',
      [Validators.required, Validators.maxLength(200)],
    ],
    bodyText: [
      this.data.template?.bodyText ?? '',
      [Validators.required, Validators.maxLength(2000), placeholderTokenValidator],
    ],
    isActive: [this.data.template?.isActive ?? true],
  });

  saving = false;
  syncingCategory = false;
  /** The category shown for a template on Meta - starts as the row's, and follows Meta after an update. */
  shownCategory: string = this.data.template?.category ?? '';
  /** True once Meta's data was pulled here, so closing the dialog refreshes the list behind it. */
  private pulledFromMeta = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: TemplateFormDialogData,
    private readonly fb: FormBuilder,
    private readonly templates: MessageTemplateService,
    private readonly media: MediaService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<TemplateFormDialogComponent, boolean>
  ) {}

  // ---- optional image ---------------------------------------------------------------------------

  /** The image chosen for this template, shown as a thumbnail; null when there is none. */
  headerAsset: MediaAsset | null = null;
  resolvingHeader = !!this.data.template?.headerMediaAssetId;
  readonly imageSearchControl = this.fb.nonNullable.control('');
  imageOptions: MediaAsset[] = [];
  loadingImageOptions = false;
  readonly formatSize = formatFileSize;
  readonly preview = (url: string): string => mediaPreviewUrl(url, environment.apiBaseUrl);
  readonly imageLimitMb = TEMPLATE_IMAGE_MAX_BYTES / (1024 * 1024);

  /** What the image field allows: anything before the template is on Meta; once it is, Meta has fixed whether it
   * has an image, so an existing one can be swapped but none can be added or removed. */
  get imageMode(): 'free' | 'swap' | 'locked' {
    const t = this.data.template;
    if (!this.isEdit || !t?.metaTemplateId) {
      return 'free';
    }
    return t.headerOnMeta ? 'swap' : 'locked';
  }

  ngOnInit(): void {
    const id = this.data.template?.headerMediaAssetId;
    if (id) {
      this.media
        .getById(id)
        .pipe(
          catchError(() => of(null)),
          finalize(() => (this.resolvingHeader = false))
        )
        .subscribe((asset) => (this.headerAsset = asset));
    }

    this.imageSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((search) => {
          this.loadingImageOptions = true;
          return this.media.getPaged({ page: 1, pageSize: 20, search: search || undefined }).pipe(
            map((page) => page.items.filter((a) => this.isUsableImage(a))),
            catchError(() => of([] as MediaAsset[])),
            finalize(() => (this.loadingImageOptions = false))
          );
        })
      )
      .subscribe((items) => (this.imageOptions = items));
  }

  /** Meta accepts only JPEG or PNG, up to 5 MB, for a message header. */
  isUsableImage(asset: MediaAsset): boolean {
    return TEMPLATE_IMAGE_CONTENT_TYPES.includes(asset.contentType.toLowerCase()) && asset.sizeBytes <= TEMPLATE_IMAGE_MAX_BYTES;
  }

  onImageSelected(event: MatAutocompleteSelectedEvent): void {
    this.headerAsset = event.option.value as MediaAsset;
    this.imageSearchControl.setValue('', { emitEvent: false });
    this.imageOptions = [];
  }

  removeImage(): void {
    this.headerAsset = null;
  }

  /** The image field's change, as the update request wants it. */
  private imagePatch(): { headerMediaAssetId?: string; removeHeaderImage?: boolean } {
    const before = this.data.template?.headerMediaAssetId ?? null;
    const now = this.headerAsset?.id ?? null;
    if (now === before) {
      return {};
    }
    return now ? { headerMediaAssetId: now } : { removeHeaderImage: true };
  }

  tokenLabel(token: string): string {
    return `{{${token}}}`;
  }

  insertToken(token: string): void {
    const control = this.form.controls.bodyText;
    control.setValue(`${control.value}{{${token}}}`);
    control.markAsDirty();
  }

  /** True when saving would silently drop this template back to Pending. */
  get willResetApproval(): boolean {
    const t = this.data.template;
    if (!this.isEdit || t?.whatsAppTemplateStatus !== WhatsAppTemplateStatus.Approved) {
      return false;
    }
    const { bodyText, language, category } = this.form.controls;
    return (
      bodyText.value !== t.bodyText ||
      (this.canEditLanguageAndCategory && (language.value !== t.language || category.value !== t.category))
    );
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const saved$: Observable<MessageTemplate> =
      this.isEdit && this.data.template
        ? this.templates.update(this.data.template.id, {
            bodyText: raw.bodyText.trim(),
            isActive: raw.isActive,
            ...this.imagePatch(),
            ...(this.canEditLanguageAndCategory
              ? { language: raw.language, category: raw.category }
              : {}),
          })
        : this.templates.create({
            name: raw.name.trim(),
            language: raw.language.trim(),
            category: raw.category,
            whatsAppTemplateName: raw.whatsAppTemplateName.trim(),
            bodyText: raw.bodyText.trim(),
            ...(this.headerAsset ? { headerMediaAssetId: this.headerAsset.id } : {}),
          });

    this.saving = true;
    saved$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEdit ? 'Template updated.' : 'Template created — pending review.');
        this.dialogRef.close(true);
      },
      error: () => {
        // ErrorInterceptor toasts it (e.g. 409 for a duplicate WhatsApp name + language).
      },
    });
  }

  /** Pulls Meta's current category (and review status) for this template and shows what Meta says. */
  updateCategoryFromMeta(): void {
    const template = this.data.template;
    if (!template || this.syncingCategory) {
      return;
    }

    this.syncingCategory = true;
    this.templates
      .syncOne(template.id)
      .pipe(finalize(() => (this.syncingCategory = false)))
      .subscribe({
        next: (result) => {
          this.pulledFromMeta = true;
          const before = this.shownCategory;
          this.shownCategory = result.template.category;
          if (result.pushError) {
            this.notify.error(`Meta did not accept the template: ${result.pushError}`);
          } else if (before !== this.shownCategory) {
            this.notify.success(`Meta has this template in ${this.shownCategory} (it was ${before}). Category updated.`);
          } else {
            this.notify.info(`Meta still has this template in ${this.shownCategory}.`);
          }
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(this.pulledFromMeta);
  }
}
