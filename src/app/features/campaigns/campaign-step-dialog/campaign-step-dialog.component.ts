import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { Campaign, CampaignStep, formatStepTypeName, nextStepNumber } from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { environment } from '../../../../environments/environment';
import { mediaPreviewUrl } from '../../../core/models/media.model';
import { MediaService } from '../../../core/services/media.service';
import {
  MessageTemplate,
  WhatsAppTemplateStatus,
  templateLanguageLabel,
  templateStatusChipClass,
} from '../../../core/models/message-template.model';
import { PlaceholderPart, splitPlaceholders } from '../../../core/utils/placeholder-tokens';
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
    messageTemplateId: [this.data.step?.messageTemplateId ?? (null as string | null)],
    isActive: [this.data.step?.isActive ?? true],
    // A step no longer carries media: a message's picture belongs to its template, and the API ignores step media.
  });

  templates: MessageTemplate[] = [];
  loadingTemplates = true;
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

    // Admin-panel-scale assumption: one page is enough to populate a select, same as the
    // roles list in UserRolesDialog. Templates are typically a small, curated set.
    this.templateService
      .getPaged({ page: 1, pageSize: 100 })
      .pipe(finalize(() => (this.loadingTemplates = false)))
      .subscribe({
        next: (page) => {
          this.templates = page.items;
          this.refreshHeaderImage();
        },
        error: () => (this.templates = []),
      });

    this.form.controls.messageTemplateId.valueChanges.subscribe(() => this.refreshHeaderImage());
  }

  readonly templateStatusClass = templateStatusChipClass;
  readonly languageLabel = templateLanguageLabel;

  /** The selected template's image, shown at the top of the preview bubble; null when it has none. */
  headerImageUrl: string | null = null;

  /** Looks up the selected template's image (a media library file) so the preview shows what customers get. */
  private refreshHeaderImage(): void {
    const id = this.selectedTemplate?.headerMediaAssetId;
    if (!id) {
      this.headerImageUrl = null;
      return;
    }
    this.media
      .getById(id)
      .pipe(catchError(() => of(null)))
      .subscribe((asset) => (this.headerImageUrl = asset ? mediaPreviewUrl(asset.previewUrl ?? asset.url, environment.apiBaseUrl) : null));
  }

  previewParts(body: string): PlaceholderPart[] {
    return splitPlaceholders(body);
  }

  /** What a highlighted placeholder turns into at send time, for its tooltip. */
  tokenHint(token: string): string {
    switch (token.toLowerCase()) {
      case 'firstname':
        return "Filled in with each customer's first name";
      case 'lastname':
        return "Filled in with each customer's last name";
      case 'phonenumber':
        return "Filled in with each customer's phone number";
      default:
        return 'Filled in for each customer';
    }
  }

  /** The template picked for this step - its approved text is what customers actually receive. */
  get selectedTemplate(): MessageTemplate | null {
    const id = this.form.controls.messageTemplateId.value;
    return (id && this.templates.find((t) => t.id === id)) || null;
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
        messageTemplateId: raw.messageTemplateId || null,
        mediaAssetIds: [],
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

}
