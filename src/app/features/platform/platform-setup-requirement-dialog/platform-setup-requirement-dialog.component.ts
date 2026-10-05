import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  SETUP_CONDITION_OPERATORS,
  SETUP_FIELD_TYPES,
  SaveRequirementRequest,
  SetupConditionOperator,
  SetupField,
  SetupFieldType,
  SetupSectionInfo,
} from '../../../core/models/application-setup.model';
import { PlatformSetupService } from '../../../core/services/platform-setup.service';
import { formatOptionLines, parseOptionLines } from '../../../core/utils/setup-options';

export interface PlatformSetupRequirementDialogData {
  versionId: string;
  /** Present when editing. */
  field?: SetupField;
  /** Every field of the version - the candidates for "depends on". */
  fields: SetupField[];
  sections: SetupSectionInfo[];
  metricKeys: string[];
}

const METRIC_LABELS: Record<string, string> = {
  package_price: 'Package price (revenue)',
  expected_customers: 'Expected customers (revenue)',
  expected_leads: 'Expected leads',
  marketing_cost: 'Marketing cost',
  social_media_cost: 'Social media cost',
  operational_cost: 'Other operational cost',
};

const CHOICE_TYPES: SetupFieldType[] = ['Dropdown', 'MultiSelect', 'Radio'];
const NUMERIC_TYPES: SetupFieldType[] = ['Number', 'Decimal', 'Currency'];
const TEXT_TYPES: SetupFieldType[] = ['Text', 'MultilineText'];

/** Add or edit one question of a plan version: what it asks, how it is checked, and when it appears. */
@Component({
  selector: 'app-platform-setup-requirement-dialog',
  templateUrl: './platform-setup-requirement-dialog.component.html',
  styleUrls: ['./platform-setup-requirement-dialog.component.scss'],
})
export class PlatformSetupRequirementDialogComponent {
  readonly isEdit = !!this.data.field;
  readonly types = SETUP_FIELD_TYPES;
  readonly operators = SETUP_CONDITION_OPERATORS;
  readonly metricLabels = METRIC_LABELS;
  saving = false;

  readonly form = this.fb.nonNullable.group({
    fieldKey: [
      this.data.field?.fieldKey ?? '',
      [Validators.required, Validators.pattern(/^[a-z][a-z0-9_]{1,59}$/)],
    ],
    label: [this.data.field?.label ?? '', [Validators.required, Validators.maxLength(150)]],
    helpText: [this.data.field?.helpText ?? '', [Validators.maxLength(500)]],
    fieldType: [(this.data.field?.fieldType ?? 'Text') as SetupFieldType, [Validators.required]],
    isRequired: [this.data.field?.isRequired ?? false],
    isActive: [this.data.field?.isActive ?? true],
    section: [this.data.field?.section ?? this.data.sections[0]?.key ?? 'business', [Validators.required, Validators.pattern(/^[a-z][a-z0-9_]{0,39}$/)]],
    displayOrder: [this.data.field?.displayOrder ?? this.nextOrder(), [Validators.required, Validators.min(0), Validators.max(100000)]],
    optionsText: [formatOptionLines(this.data.field?.options ?? [])],
    defaultValue: [this.data.field?.defaultValue ?? '', [Validators.maxLength(1000)]],
    min: [this.data.field?.validation?.min ?? (null as number | null)],
    max: [this.data.field?.validation?.max ?? (null as number | null)],
    minLength: [this.data.field?.validation?.minLength ?? (null as number | null)],
    maxLength: [this.data.field?.validation?.maxLength ?? (null as number | null)],
    pattern: [this.data.field?.validation?.pattern ?? ''],
    patternMessage: [this.data.field?.validation?.patternMessage ?? ''],
    conditionFieldKey: [this.data.field?.condition?.fieldKey ?? ''],
    conditionOperator: [(this.data.field?.condition?.operator ?? 'Equals') as SetupConditionOperator],
    conditionValue: [this.data.field?.condition?.value ?? ''],
    metricKey: [this.data.field?.metricKey ?? ''],
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformSetupRequirementDialogData,
    private readonly fb: FormBuilder,
    private readonly service: PlatformSetupService,
    private readonly dialogRef: MatDialogRef<PlatformSetupRequirementDialogComponent, boolean>
  ) {}

  get type(): SetupFieldType {
    return this.form.controls.fieldType.value;
  }

  get isChoice(): boolean {
    return CHOICE_TYPES.includes(this.type);
  }

  get isNumeric(): boolean {
    return NUMERIC_TYPES.includes(this.type);
  }

  get isText(): boolean {
    return TEXT_TYPES.includes(this.type);
  }

  get isMulti(): boolean {
    return this.type === 'MultiSelect';
  }

  get showsRules(): boolean {
    return this.isNumeric || this.isText || this.isMulti;
  }

  /** Other questions this one may depend on. */
  get parents(): SetupField[] {
    return this.data.fields.filter((f) => f.id !== this.data.field?.id);
  }

  get parent(): SetupField | undefined {
    const key = this.form.controls.conditionFieldKey.value;
    return this.data.fields.find((f) => f.fieldKey === key);
  }

  get operatorNeedsValue(): boolean {
    return this.operators.find((o) => o.value === this.form.controls.conditionOperator.value)?.needsValue ?? true;
  }

  get typeHint(): string {
    return this.types.find((t) => t.value === this.type)?.hint ?? '';
  }

  /** The default answer for a multi-select is a comma separated list of option values. */
  get defaultHint(): string {
    return this.isMulti ? 'Option values, separated by commas.' : this.isChoice ? 'The value of one option.' : 'Pre-fills the answer.';
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving) {
      return;
    }
    const v = this.form.getRawValue();
    const options = this.isChoice ? parseOptionLines(v.optionsText) : null;
    if (this.isChoice && !options?.length) {
      this.form.controls.optionsText.setErrors({ required: true });
      return;
    }

    const hasRules = [v.min, v.max, v.minLength, v.maxLength].some((n) => n !== null && n !== undefined) || !!v.pattern.trim();
    const request: SaveRequirementRequest = {
      fieldKey: v.fieldKey.trim(),
      label: v.label.trim(),
      helpText: v.helpText.trim() || null,
      fieldType: v.fieldType,
      isRequired: v.isRequired,
      defaultValue: v.defaultValue.trim() || null,
      options,
      validation:
        this.showsRules && hasRules
          ? {
              min: this.isNumeric || this.isMulti ? v.min : null,
              max: this.isNumeric || this.isMulti ? v.max : null,
              minLength: this.isText ? v.minLength : null,
              maxLength: this.isText ? v.maxLength : null,
              pattern: this.isText && v.pattern.trim() ? v.pattern.trim() : null,
              patternMessage: this.isText && v.pattern.trim() ? v.patternMessage.trim() || null : null,
            }
          : null,
      displayOrder: v.displayOrder,
      section: v.section.trim().toLowerCase(),
      condition: v.conditionFieldKey
        ? {
            fieldKey: v.conditionFieldKey,
            operator: v.conditionOperator,
            value: this.operatorNeedsValue ? v.conditionValue.trim() || null : null,
          }
        : null,
      metricKey: v.metricKey || null,
      isActive: v.isActive,
    };

    this.saving = true;
    const call = this.data.field
      ? this.service.updateRequirement(this.data.field.id, request)
      : this.service.addRequirement(this.data.versionId, request);
    call.pipe(finalize(() => (this.saving = false))).subscribe(() => this.dialogRef.close(true));
  }

  /** New questions go to the end of their section. */
  private nextOrder(): number {
    const orders = this.data.fields.map((f) => f.displayOrder);
    return (orders.length ? Math.max(...orders) : 0) + 10;
  }
}
