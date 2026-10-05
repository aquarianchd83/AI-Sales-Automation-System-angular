import { Component, Inject } from '@angular/core';
import { FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  PACKAGE_DURATION_UNITS,
  PACKAGE_LIMITS,
  PackageDurationUnit,
  SalesPackage,
  parseFeatureLines,
} from '../../../core/models/package.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PackageService } from '../../../core/services/package.service';

export interface PackageFormDialogData {
  mode: 'create' | 'edit';
  package?: SalesPackage;
  currencySymbol: string;
}

@Component({
  selector: 'app-package-form-dialog',
  templateUrl: './package-form-dialog.component.html',
  styleUrls: ['./package-form-dialog.component.scss'],
})
export class PackageFormDialogComponent {
  readonly isEdit = this.data.mode === 'edit';
  readonly limits = PACKAGE_LIMITS;
  readonly units = PACKAGE_DURATION_UNITS;

  readonly form = this.fb.nonNullable.group({
    name: [this.data.package?.name ?? '', [Validators.required, Validators.maxLength(PACKAGE_LIMITS.name)]],
    description: [this.data.package?.description ?? '', [Validators.maxLength(PACKAGE_LIMITS.description)]],
    price: [this.data.package?.price ?? 0, [Validators.required, Validators.min(0), Validators.max(PACKAGE_LIMITS.maxPrice)]],
    durationValue: [
      this.data.package?.durationValue ?? 1,
      [Validators.required, Validators.min(1), Validators.max(PACKAGE_LIMITS.maxDuration)],
    ],
    durationUnit: [(this.data.package?.durationUnit ?? 'Months') as PackageDurationUnit, [Validators.required]],
    features: [
      (this.data.package?.features ?? []).join('\n'),
      [(control: { value: string }): ValidationErrors | null => this.featuresError(control.value)],
    ],
    expectedSales: [
      this.data.package?.expectedSales ?? 0,
      [Validators.required, Validators.min(0), Validators.max(PACKAGE_LIMITS.maxExpectedSales)],
    ],
    isActive: [this.data.package?.isActive ?? true],
  });

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: PackageFormDialogData,
    private readonly fb: FormBuilder,
    private readonly packages: PackageService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PackageFormDialogComponent, boolean>
  ) {}

  /** Live preview under the form: what this package brings in per month if the target is met. */
  get projectedRevenue(): number {
    const { price, expectedSales } = this.form.getRawValue();
    return (Number(price) || 0) * (Number(expectedSales) || 0);
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const request = {
      name: value.name.trim(),
      description: value.description.trim() || null,
      price: Number(value.price),
      durationValue: Number(value.durationValue),
      durationUnit: value.durationUnit,
      features: parseFeatureLines(value.features),
      expectedSales: Number(value.expectedSales),
      isActive: value.isActive,
    };

    const saved$: Observable<SalesPackage> =
      this.isEdit && this.data.package
        ? this.packages.update(this.data.package.id, request)
        : this.packages.create(request);

    this.saving = true;
    saved$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEdit ? 'Package updated.' : 'Package created.');
        this.dialogRef.close(true);
      },
      error: () => {
        // ErrorInterceptor surfaces the 409 / 400 message — keep the dialog open so the edit isn't lost.
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  private featuresError(text: string): ValidationErrors | null {
    const lines = parseFeatureLines(text ?? '');
    if (lines.length > PACKAGE_LIMITS.maxFeatures) {
      return { tooManyFeatures: true };
    }
    return lines.some((line) => line.length > PACKAGE_LIMITS.featureLength) ? { featureTooLong: true } : null;
  }
}
