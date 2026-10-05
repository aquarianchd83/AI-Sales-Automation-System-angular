import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import {
  SETUP_CONDITION_OPERATORS,
  SETUP_FIELD_TYPES,
  SetupField,
  SetupVersionDetail,
  describeSetupSection,
} from '../../../core/models/application-setup.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformSetupService } from '../../../core/services/platform-setup.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  PlatformSetupRequirementDialogComponent,
  PlatformSetupRequirementDialogData,
} from '../platform-setup-requirement-dialog/platform-setup-requirement-dialog.component';
import { PlatformSetupPreviewDialogComponent, PlatformSetupPreviewData } from '../platform-setup-preview-dialog/platform-setup-preview-dialog.component';

interface SectionGroup {
  key: string;
  title: string;
  fields: SetupField[];
}

/** Edit one version of a plan's setup: its questions, rules and conditions. Only a draft can be edited; publishing makes it live for new applications. */
@Component({
  selector: 'app-platform-setup-version',
  templateUrl: './platform-setup-version.component.html',
  styleUrls: ['./platform-setup-version.component.scss'],
})
export class PlatformSetupVersionComponent implements OnInit {
  version: SetupVersionDetail | null = null;
  groups: SectionGroup[] = [];
  loading = true;
  busy = false;
  readonly columns = ['order', 'question', 'type', 'required', 'visibility', 'active', 'actions'];

  readonly settings = this.fb.group({
    releaseNotes: ['', [Validators.maxLength(1000)]],
    validityDays: [null as number | null, [Validators.min(1), Validators.max(3650)]],
  });

  private id = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly service: PlatformSetupService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  get isDraft(): boolean {
    return this.version?.status === 'Draft';
  }

  get activeCount(): number {
    return this.version?.fields.filter((f) => f.isActive).length ?? 0;
  }

  load(): void {
    this.loading = true;
    this.service
      .getVersion(this.id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (version) => this.apply(version),
        error: () => void this.router.navigate(['/platform/setup-plans']),
      });
  }

  typeLabel(field: SetupField): string {
    return SETUP_FIELD_TYPES.find((t) => t.value === field.fieldType)?.label ?? field.fieldType;
  }

  /** "Shown when Run paid ads is Yes" - or an empty string when the question is always shown. */
  visibility(field: SetupField): string {
    if (!field.condition || !this.version) {
      return '';
    }
    const parent = this.version.fields.find((f) => f.fieldKey === field.condition!.fieldKey);
    const op = SETUP_CONDITION_OPERATORS.find((o) => o.value === field.condition!.operator);
    const value = parent?.options.find((o) => o.value === field.condition!.value)?.label ?? field.condition.value ?? '';
    return `${parent?.label ?? field.condition.fieldKey} ${op?.label.replace(' (comma separated)', '') ?? ''} ${value}`.trim();
  }

  saveSettings(): void {
    if (!this.version || this.settings.invalid) {
      return;
    }
    const value = this.settings.getRawValue();
    this.busy = true;
    this.service
      .updateVersion(this.version.id, { releaseNotes: value.releaseNotes?.trim() || null, validityDays: value.validityDays })
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((version) => {
        this.apply(version);
        this.notify.success('Version settings saved.');
      });
  }

  add(): void {
    this.openForm();
  }

  edit(field: SetupField): void {
    this.openForm(field);
  }

  private openForm(field?: SetupField): void {
    if (!this.version) {
      return;
    }
    const data: PlatformSetupRequirementDialogData = {
      versionId: this.version.id,
      field,
      fields: this.version.fields,
      sections: this.version.sections,
      metricKeys: this.version.metricKeys,
    };
    this.dialog
      .open(PlatformSetupRequirementDialogComponent, { data, width: '720px', maxWidth: '95vw', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.notify.success(field ? 'Question saved.' : 'Question added.');
          this.load();
        }
      });
  }

  toggleActive(field: SetupField): void {
    this.update(field, { ...this.toRequest(field), isActive: !field.isActive });
  }

  /** Swaps this question's order with its neighbour in the same step. */
  move(group: SectionGroup, field: SetupField, direction: -1 | 1): void {
    const index = group.fields.indexOf(field);
    const other = group.fields[index + direction];
    if (!other) {
      return;
    }
    // Neighbours may share an order number; give them distinct ones on either side of the swap.
    const [first, second] = direction === -1 ? [field, other] : [other, field];
    const base = Math.min(first.displayOrder, second.displayOrder);
    this.busy = true;
    forkJoin([
      this.service.updateRequirement(first.id, { ...this.toRequest(first), displayOrder: base + 1 }),
      this.service.updateRequirement(second.id, { ...this.toRequest(second), displayOrder: base }),
    ])
      .pipe(finalize(() => (this.busy = false)))
      .subscribe(() => this.load());
  }

  remove(field: SetupField): void {
    const data: ConfirmDialogData = {
      title: `Delete "${field.label}"?`,
      message: 'The question is removed from this draft. Answers Talents already gave on earlier versions are not affected. To hide it instead, mark it inactive.',
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.service.deleteRequirement(field.id).subscribe(() => {
            this.notify.success('Question deleted.');
            this.load();
          });
        }
      });
  }

  preview(): void {
    if (!this.version) {
      return;
    }
    const data: PlatformSetupPreviewData = { versionId: this.version.id };
    this.dialog.open(PlatformSetupPreviewDialogComponent, { data, width: '1100px', maxWidth: '96vw' });
  }

  publish(): void {
    if (!this.version) {
      return;
    }
    const data: ConfirmDialogData = {
      title: `Publish version ${this.version.versionNumber}?`,
      message:
        `New applications on ${this.version.planName} will use this version straight away. Applications already running keep their ` +
        'current version until their owner chooses to update.',
      confirmLabel: 'Publish',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '480px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.busy = true;
        this.service
          .publish(this.id)
          .pipe(finalize(() => (this.busy = false)))
          .subscribe((version) => {
            this.apply(version);
            this.notify.success(`Version ${version.versionNumber} is live.`);
          });
      });
  }

  discard(): void {
    const data: ConfirmDialogData = {
      title: 'Discard this draft?',
      message: 'The draft and its questions are deleted. Nothing live changes.',
      confirmLabel: 'Discard',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.service.deleteVersion(this.id).subscribe(() => {
            this.notify.success('Draft discarded.');
            void this.router.navigate(['/platform/setup-plans']);
          });
        }
      });
  }

  /** Starts a new draft from this version (the way to change something that is already published). */
  newVersionFromThis(): void {
    if (!this.version) {
      return;
    }
    this.busy = true;
    this.service
      .createVersion(this.version.planId, null, this.version.id)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((created) => {
        this.notify.success(`Draft version ${created.versionNumber} created from version ${this.version?.versionNumber}.`);
        void this.router.navigate(['/platform/setup-plans/versions', created.id]).then(() => {
          this.id = created.id;
          this.load();
        });
      });
  }

  trackGroup(_: number, group: SectionGroup): string {
    return group.key;
  }

  private update(field: SetupField, request: ReturnType<PlatformSetupVersionComponent['toRequest']>): void {
    this.busy = true;
    this.service
      .updateRequirement(field.id, request)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe(() => this.load());
  }

  private toRequest(f: SetupField) {
    return {
      fieldKey: f.fieldKey,
      label: f.label,
      helpText: f.helpText,
      fieldType: f.fieldType,
      isRequired: f.isRequired,
      defaultValue: f.defaultValue,
      options: f.options.length ? f.options : null,
      validation: f.validation,
      displayOrder: f.displayOrder,
      section: f.section,
      condition: f.condition,
      metricKey: f.metricKey,
      isActive: f.isActive,
    };
  }

  private apply(version: SetupVersionDetail): void {
    this.version = version;
    this.settings.reset({ releaseNotes: version.releaseNotes ?? '', validityDays: version.validityDays });
    if (version.status === 'Draft') {
      this.settings.enable();
    } else {
      this.settings.disable();
    }

    const order = new Map(version.sections.map((s) => [s.key, s]));
    const byKey = new Map<string, SetupField[]>();
    for (const field of version.fields) {
      byKey.set(field.section, [...(byKey.get(field.section) ?? []), field]);
    }
    this.groups = [...byKey.entries()]
      .map(([key, fields]) => ({
        key,
        title: order.get(key)?.title ?? describeSetupSection(key),
        fields: fields.sort((a, b) => a.displayOrder - b.displayOrder || a.label.localeCompare(b.label)),
        rank: order.get(key)?.order ?? 100,
      }))
      .sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title))
      .map(({ key, title, fields }) => ({ key, title, fields }));
  }
}
