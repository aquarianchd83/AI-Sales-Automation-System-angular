import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap } from 'rxjs/operators';

import { Campaign, CampaignStep, formatStepTypeName, nextStepNumber } from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { KNOWN_PLACEHOLDER_TOKENS, placeholderTokenValidator } from '../../../core/utils/placeholder-tokens';
import { MediaAsset, formatFileSize } from '../../../core/models/media.model';
import { MediaService } from '../../../core/services/media.service';
import { MessageTemplate, WhatsAppTemplateStatus } from '../../../core/models/message-template.model';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface CampaignStepDialogData {
  campaignId: string;
  existingSteps: CampaignStep[];
  step?: CampaignStep;
}

@Component({
  selector: 'app-campaign-step-dialog',
  templateUrl: './campaign-step-dialog.component.html',
  styleUrls: ['./campaign-step-dialog.component.scss'],
})
export class CampaignStepDialogComponent implements OnInit {
  readonly isEdit = !!this.data.step;
  readonly knownTokens = KNOWN_PLACEHOLDER_TOKENS;
  readonly WhatsAppTemplateStatus = WhatsAppTemplateStatus;

  /**
   * The type this dialog attaches — never a real choice: editing keeps the step's own
   * type, and creating always targets the next number in sequence (Initial, then
   * FollowUp1, FollowUp2, …, with no upper bound), since CampaignService.UpsertStepAsync
   * 400s on anything else.
   */
  readonly fixedStepType: string = this.data.step?.stepType ?? formatStepTypeName(nextStepNumber(this.data.existingSteps));

  readonly form = this.fb.nonNullable.group({
    stepType: [{ value: this.fixedStepType, disabled: true }, [Validators.required]],
    delayDaysAfterPrevious: [this.data.step?.delayDaysAfterPrevious ?? 0, [Validators.required]],
    messageText: [
      this.data.step?.messageText ?? '',
      [Validators.required, Validators.maxLength(2000), placeholderTokenValidator],
    ],
    messageTemplateId: [this.data.step?.messageTemplateId ?? (null as string | null)],
    isActive: [this.data.step?.isActive ?? true],
    // No client-side min/max validator: the server's CampaignOptions.MinStepMedia/
    // MaxStepMedia is configurable (and already overridden to 0 in this dev environment
    // per appsettings.Development.json), so a hardcoded client range would drift out of
    // sync with whatever the API is actually enforcing. minMedia/maxMedia below stay as
    // a non-blocking hint; the API's own 400 is what's authoritative, surfaced by
    // ErrorInterceptor if the count it currently requires isn't met.
    mediaAssetIds: [[...(this.data.step?.mediaAssetIds ?? [])]],
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
    // stepType is fixed (see fixedStepType) and never changes after init, so this only
    // needs to run once — no valueChanges subscription to keep it in sync.
    this.applyDelayRuleFor(this.fixedStepType);

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
    if (stepType === 'Initial') {
      control.setValue(0);
      control.disable();
    } else {
      control.enable();
      control.setValidators([Validators.required, Validators.min(0)]);
      control.updateValueAndValidity();
    }
  }

  /** Bounded by however many media ids the step already had — cheap even as N individual GETs. */
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
