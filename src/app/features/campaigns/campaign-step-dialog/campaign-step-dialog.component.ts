import { Component, Inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap } from 'rxjs/operators';

import {
  CAMPAIGN_STEP_TYPES_IN_ORDER,
  Campaign,
  CampaignStep,
  CampaignStepType,
  DEFAULT_MAX_STEP_MEDIA,
  DEFAULT_MIN_STEP_MEDIA,
} from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { KNOWN_PLACEHOLDER_TOKENS, placeholderTokenValidator } from '../../../core/utils/placeholder-tokens';
import { MediaAsset, formatFileSize } from '../../../core/models/media.model';
import { MediaService } from '../../../core/services/media.service';
import { MessageTemplate, WhatsAppTemplateStatus } from '../../../core/models/message-template.model';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface CampaignStepDialogData {
  campaignId: string;
  existingStepTypes: string[];
  step?: CampaignStep;
  /** Pre-selects this type in create mode, e.g. when opened from an "Add FollowUp1" menu item. */
  preferredStepType?: string;
}

function mediaCountValidator(min: number, max: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const ids = (control.value as string[] | null) ?? [];
    return ids.length < min || ids.length > max ? { mediaCount: { min, max, actual: ids.length } } : null;
  };
}

@Component({
  selector: 'app-campaign-step-dialog',
  templateUrl: './campaign-step-dialog.component.html',
  styleUrls: ['./campaign-step-dialog.component.scss'],
})
export class CampaignStepDialogComponent implements OnInit {
  readonly isEdit = !!this.data.step;
  readonly minMedia = DEFAULT_MIN_STEP_MEDIA;
  readonly maxMedia = DEFAULT_MAX_STEP_MEDIA;
  readonly knownTokens = KNOWN_PLACEHOLDER_TOKENS;
  readonly WhatsAppTemplateStatus = WhatsAppTemplateStatus;

  /** In create mode, only step types the campaign doesn't already have. */
  readonly availableStepTypes = CAMPAIGN_STEP_TYPES_IN_ORDER.filter(
    (type) => this.isEdit || !this.data.existingStepTypes.includes(type)
  );

  readonly form = this.fb.nonNullable.group({
    stepType: [
      {
        value:
          this.data.step?.stepType ??
          (this.data.preferredStepType && this.availableStepTypes.includes(this.data.preferredStepType as CampaignStepType)
            ? this.data.preferredStepType
            : this.availableStepTypes[0] ?? ''),
        disabled: this.isEdit,
      },
      [Validators.required],
    ],
    delayDaysAfterPrevious: [this.data.step?.delayDaysAfterPrevious ?? 0, [Validators.required]],
    messageText: [
      this.data.step?.messageText ?? '',
      [Validators.required, Validators.maxLength(2000), placeholderTokenValidator],
    ],
    messageTemplateId: [this.data.step?.messageTemplateId ?? (null as string | null)],
    isActive: [this.data.step?.isActive ?? true],
    mediaAssetIds: [
      [...(this.data.step?.mediaAssetIds ?? [])],
      [mediaCountValidator(this.minMedia, this.maxMedia)],
    ],
  });

  readonly mediaSearchControl = this.fb.nonNullable.control('');
  mediaOptions: MediaAsset[] = [];
  selectedMedia: MediaAsset[] = [];
  loadingMediaOptions = false;

  templates: MessageTemplate[] = [];
  loadingTemplates = true;
  resolvingExistingMedia = this.isEdit;
  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CampaignStepDialogData,
    private readonly fb: FormBuilder,
    private readonly campaigns: CampaignService,
    private readonly media: MediaService,
    private readonly templateService: MessageTemplateService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CampaignStepDialogComponent, Campaign | undefined>
  ) {}

  ngOnInit(): void {
    this.applyDelayRuleFor(this.form.controls.stepType.value);
    this.form.controls.stepType.valueChanges.subscribe((type) => this.applyDelayRuleFor(type));

    this.mediaSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((search) => {
          this.loadingMediaOptions = true;
          return this.media.getPaged({ page: 1, pageSize: 10, search: search || undefined }).pipe(
            map((page) => page.items),
            finalize(() => (this.loadingMediaOptions = false))
          );
        })
      )
      .subscribe((items) => (this.mediaOptions = items));

    // Admin-panel-scale assumption: one page is enough to populate a select, same as the
    // roles list in UserRolesDialog. Templates are typically a small, curated set.
    this.templateService
      .getPaged({ page: 1, pageSize: 100 })
      .pipe(finalize(() => (this.loadingTemplates = false)))
      .subscribe({
        next: (page) => (this.templates = page.items),
        error: () => (this.templates = []),
      });

    if (this.isEdit && this.data.step) {
      this.resolveExistingMedia(this.data.step.mediaAssetIds);
    }
  }

  onMediaSelected(event: MatAutocompleteSelectedEvent): void {
    const asset = event.option.value as MediaAsset;
    if (!this.selectedMedia.some((m) => m.id === asset.id)) {
      this.selectedMedia = [...this.selectedMedia, asset];
      this.form.controls.mediaAssetIds.setValue(this.selectedMedia.map((m) => m.id));
      this.form.controls.mediaAssetIds.markAsTouched();
    }
    this.mediaSearchControl.setValue('');
  }

  removeMedia(asset: MediaAsset): void {
    this.selectedMedia = this.selectedMedia.filter((m) => m.id !== asset.id);
    this.form.controls.mediaAssetIds.setValue(this.selectedMedia.map((m) => m.id));
    this.form.controls.mediaAssetIds.markAsTouched();
  }

  formatSize(bytes: number): string {
    return formatFileSize(bytes);
  }

  insertToken(token: string): void {
    const control = this.form.controls.messageText;
    control.setValue(`${control.value}{{${token}}}`);
    control.markAsDirty();
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.saving = true;
    this.campaigns
      .upsertStep(this.data.campaignId, {
        stepType: raw.stepType,
        delayDaysAfterPrevious: raw.delayDaysAfterPrevious,
        messageText: raw.messageText.trim(),
        messageTemplateId: raw.messageTemplateId || null,
        mediaAssetIds: raw.mediaAssetIds,
        isActive: raw.isActive,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (campaign) => {
          this.notify.success(this.isEdit ? 'Step updated.' : 'Step added.');
          this.dialogRef.close(campaign);
        },
        error: () => {
          // ErrorInterceptor toasts it (media/template ids that vanished since the dialog opened).
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  private applyDelayRuleFor(stepType: string): void {
    const control = this.form.controls.delayDaysAfterPrevious;
    if (stepType === CampaignStepType.Initial) {
      control.setValue(0);
      control.disable();
    } else {
      control.enable();
      control.setValidators([Validators.required, Validators.min(0)]);
      control.updateValueAndValidity();
    }
  }

  /** Bounded by maxMedia (5) — cheap even as N individual GETs. */
  private resolveExistingMedia(ids: string[]): void {
    // A media asset could have been deleted since this step was saved — drop it from the
    // chip list rather than fail the whole dialog.
    const lookups: Observable<MediaAsset | null>[] = ids.map((id) =>
      this.media.getById(id).pipe(catchError(() => of(null)))
    );

    (lookups.length ? forkJoin(lookups) : of([]))
      .pipe(finalize(() => (this.resolvingExistingMedia = false)))
      .subscribe((assets) => {
        this.selectedMedia = assets.filter((a): a is MediaAsset => a !== null);
      });
  }
}
