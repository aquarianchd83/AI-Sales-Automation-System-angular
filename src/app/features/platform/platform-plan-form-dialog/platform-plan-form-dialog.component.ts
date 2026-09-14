import { Component, Inject } from '@angular/core';
import { NonNullableFormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { CreatePlanRequest, PlatformPlan, UpdatePlanRequest } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformBillingService } from '../../../core/services/platform-billing.service';

export interface PlatformPlanFormDialogData {
  /** Null means "create a new plan" — otherwise the plan being edited. */
  plan: PlatformPlan | null;
}

/** PlatformSuperAdmin-only add/edit form for one row of the plan catalog. Code is required and
 * editable only when creating a plan — Plan.Code is immutable once it exists (see its own doc
 * comment), so the field is disabled in edit mode rather than just omitted, to still show which
 * plan is being edited. Price is entered/shown in dollars and converted to/from
 * PriceMonthlyCents at the edges, the same way SettingsListComponent-style forms convert at their
 * own boundaries. */
@Component({
  selector: 'app-platform-plan-form-dialog',
  templateUrl: './platform-plan-form-dialog.component.html',
})
export class PlatformPlanFormDialogComponent {
  readonly isEditMode = this.data.plan !== null;

  readonly form = this.fb.group({
    code: [
      { value: this.data.plan?.code ?? '', disabled: this.isEditMode },
      [Validators.required, Validators.pattern(/^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/)],
    ],
    name: [this.data.plan?.name ?? '', Validators.required],
    maxUsers: [this.data.plan?.maxUsers ?? 0, [Validators.required, Validators.min(0)]],
    maxMessagesPerMonth: [this.data.plan?.maxMessagesPerMonth ?? 0, [Validators.required, Validators.min(0)]],
    maxCampaigns: [this.data.plan?.maxCampaigns ?? 0, [Validators.required, Validators.min(0)]],
    maxKnowledgeBaseArticles: [this.data.plan?.maxKnowledgeBaseArticles ?? 0, [Validators.required, Validators.min(0)]],
    priceMonthlyDollars: [
      this.data.plan ? this.data.plan.priceMonthlyCents / 100 : 0,
      [Validators.required, Validators.min(0)],
    ],
    isActive: [this.data.plan?.isActive ?? true],
  });

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly billing: PlatformBillingService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformPlanFormDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformPlanFormDialogData
  ) {}

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const priceMonthlyCents = Math.round(raw.priceMonthlyDollars * 100);

    this.saving = true;
    const request$ = this.isEditMode
      ? this.billing.updatePlan(this.data.plan!.id, {
          name: raw.name,
          maxUsers: raw.maxUsers,
          maxMessagesPerMonth: raw.maxMessagesPerMonth,
          maxCampaigns: raw.maxCampaigns,
          maxKnowledgeBaseArticles: raw.maxKnowledgeBaseArticles,
          priceMonthlyCents,
          isActive: raw.isActive,
        } as UpdatePlanRequest)
      : this.billing.createPlan({
          code: raw.code,
          name: raw.name,
          maxUsers: raw.maxUsers,
          maxMessagesPerMonth: raw.maxMessagesPerMonth,
          maxCampaigns: raw.maxCampaigns,
          maxKnowledgeBaseArticles: raw.maxKnowledgeBaseArticles,
          priceMonthlyCents,
        } as CreatePlanRequest);

    request$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEditMode ? 'Plan updated.' : 'Plan created.');
        this.dialogRef.close(true);
      },
      error: () => {
        /* ErrorInterceptor toasts it; keep the dialog open */
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
