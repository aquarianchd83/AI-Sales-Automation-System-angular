import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  SIMULATOR_CATEGORY_TABS,
  SIMULATOR_VARIANT_LABELS,
  SaveSimulatorDummyRecordRequest,
  SimulatorDataCategory,
  SimulatorDummyRecord,
  SimulatorKey,
  SimulatorLeadVariant,
  isKeyedCategory,
} from '../../../core/models/simulator-data.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SimulatorDataService } from '../../../core/services/simulator-data.service';

export interface PlatformSimulatorDataDialogData {
  category: SimulatorDataCategory;
  record?: SimulatorDummyRecord;
  /** The keys of this kind that no row uses yet (plus the row's own key when editing). */
  freeKeys: SimulatorKey[];
  nextOrder: number;
}

@Component({
  selector: 'app-platform-simulator-data-dialog',
  templateUrl: './platform-simulator-data-dialog.component.html',
  styles: [
    `
      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 12px;
      }
      .grid .span-2 {
        grid-column: span 2;
      }
      @media (max-width: 600px) {
        .grid {
          grid-template-columns: 1fr;
        }
        .grid .span-2 {
          grid-column: auto;
        }
      }
      .help {
        margin: -4px 0 12px;
        font-size: 12px;
      }
      .active-toggle {
        display: block;
        margin: 4px 0 8px;
      }
    `,
  ],
})
export class PlatformSimulatorDataDialogComponent {
  readonly Category = SimulatorDataCategory;
  readonly isEdit = !!this.data.record;
  readonly category = this.data.category;
  readonly keyed = isKeyedCategory(this.category);
  readonly tab = SIMULATOR_CATEGORY_TABS.find((t) => t.category === this.category)!;
  readonly variants = [SimulatorLeadVariant.Qualified, SimulatorLeadVariant.PhoneNotOnPage, SimulatorLeadVariant.PermanentlyClosed];
  readonly variantLabels = SIMULATOR_VARIANT_LABELS;
  saving = false;

  private readonly r = this.data.record;

  readonly form = this.fb.group({
    name: [this.r?.name ?? (this.keyed ? this.data.freeKeys[0]?.key ?? '' : ''), [Validators.required, Validators.maxLength(200)]],
    value: [this.r?.value ?? (this.keyed ? this.data.freeKeys[0]?.defaultValue ?? '' : ''), this.keyed ? [Validators.required, Validators.maxLength(4000)] : []],
    businessType: [this.r?.businessType ?? ''],
    contactPerson: [this.r?.contactPerson ?? ''],
    address: [this.r?.address ?? ''],
    city: [this.r?.city ?? ''],
    phone: [this.r?.phone ?? '', this.category === SimulatorDataCategory.LeadBusiness ? [Validators.required] : []],
    email: [this.r?.email ?? '', [Validators.email]],
    website: [this.r?.website ?? ''],
    leadScore: [this.r?.leadScore ?? 75, [Validators.min(0), Validators.max(100)]],
    variant: [this.r?.variant ?? SimulatorLeadVariant.Qualified],
    isActive: [this.r?.isActive ?? true],
    displayOrder: [this.r?.displayOrder ?? this.data.nextOrder],
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly service: SimulatorDataService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformSimulatorDataDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformSimulatorDataDialogData
  ) {
    // A keyed row keeps its key: the simulator looks it up by that name.
    if (this.isEdit && this.keyed) {
      this.form.controls.name.disable();
    }
  }

  get selectedKey(): SimulatorKey | undefined {
    const name = (this.form.controls.name.value ?? '').toLowerCase();
    return this.data.freeKeys.find((k) => k.key.toLowerCase() === name);
  }

  /** Picking another key fills in its built-in value, so the admin edits from a working starting point. */
  keyChanged(): void {
    if (!this.isEdit && this.selectedKey) {
      this.form.controls.value.setValue(this.selectedKey.defaultValue);
    }
  }

  useDefault(): void {
    if (this.selectedKey) {
      this.form.controls.value.setValue(this.selectedKey.defaultValue);
    }
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const text = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
    const business = this.category === SimulatorDataCategory.LeadBusiness;
    const request: SaveSimulatorDummyRecordRequest = {
      category: this.category,
      name: (v.name ?? '').trim(),
      value: this.keyed ? (v.value ?? '').trim() : null,
      businessType: business ? text(v.businessType) : null,
      contactPerson: business ? text(v.contactPerson) : null,
      address: business ? text(v.address) : null,
      city: business ? text(v.city) : null,
      phone: business ? text(v.phone) : null,
      email: business ? text(v.email) : null,
      website: business ? text(v.website) : null,
      leadScore: business ? Number(v.leadScore ?? 75) : null,
      variant: business ? v.variant ?? SimulatorLeadVariant.Qualified : null,
      isActive: !!v.isActive,
      displayOrder: Number(v.displayOrder ?? 0),
    };

    this.saving = true;
    const call = this.isEdit ? this.service.update(this.r!.id, request) : this.service.create(request);
    call.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEdit ? 'Dummy data update ho gaya.' : 'Dummy data add ho gaya.');
        this.dialogRef.close(true);
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
