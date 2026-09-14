import { Component, Inject } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { TenantSettingCategory, UpdateTenantSettingsRequest } from '../../../core/models/tenant-settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformTenantConfigService } from '../../../core/services/platform-tenant-config.service';

export interface PlatformTenantConfigOverridesDialogData {
  tenantId: string;
  tenantName: string;
  categories: TenantSettingCategory[];
}

/** List-value items are edited as comma-separated text and split/joined at the edges - same
 * convention SettingsListComponent (the platform-global Configuration screen) already uses. */
const LIST_SEPARATOR = ',';

/** PlatformSuperAdmin-only editor for one tenant's Campaigns/Media/Messaging/Ai tuning overrides -
 * see AppSettingDefinition.IsTenantOverridable's own doc comment for which keys these are and why.
 * Unlike the WhatsApp/AI provider dialogs, nothing here is a secret: every field is pre-filled with
 * the tenant's current override (blank if none) and shows the platform default as a hint, so an admin
 * can see exactly what they're overriding. One flat form keyed by each item's `key` (globally unique
 * across categories, e.g. "Messaging:MaxSendsPerRun"), grouped into a tab per category purely for
 * display - same tab-per-category layout as the global Configuration screen. */
@Component({
  selector: 'app-platform-tenant-config-overrides-dialog',
  templateUrl: './platform-tenant-config-overrides-dialog.component.html',
  styles: [
    `
      .setting-row {
        margin-bottom: 8px;
      }

      .note {
        margin: 8px 0 0;
        font-size: 12px;
      }
    `,
  ],
})
export class PlatformTenantConfigOverridesDialogComponent {
  readonly form: FormGroup<Record<string, FormControl<string>>>;

  saving = false;

  constructor(
    private readonly fb: NonNullableFormBuilder,
    private readonly configService: PlatformTenantConfigService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformTenantConfigOverridesDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformTenantConfigOverridesDialogData
  ) {
    const controls: Record<string, FormControl<string>> = {};
    for (const category of data.categories) {
      for (const item of category.items) {
        controls[item.key] = this.fb.control(item.overrideValue ?? '');
      }
    }
    this.form = this.fb.group(controls);
  }

  save(): void {
    if (this.saving) {
      return;
    }

    const values: Record<string, string | null> = {};
    for (const category of this.data.categories) {
      for (const item of category.items) {
        const control = this.form.controls[item.key];
        if (!control.dirty) {
          continue;
        }

        const raw = control.value.trim();
        if (!raw) {
          // Blank clears the override, whatever the key - back to the platform default.
          values[item.key] = null;
          continue;
        }

        values[item.key] = item.isList
          ? raw
              .split(LIST_SEPARATOR)
              .map((part) => part.trim())
              .filter(Boolean)
              .join(LIST_SEPARATOR)
          : raw;
      }
    }

    if (!Object.keys(values).length) {
      this.notify.info('No changes to save.');
      return;
    }

    const request: UpdateTenantSettingsRequest = { values };

    this.saving = true;
    this.configService
      .saveConfigOverrides(this.data.tenantId, request)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.notify.success('Advanced settings saved.');
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
