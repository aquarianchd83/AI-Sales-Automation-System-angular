import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingCategory, SettingItem } from '../../../core/models/settings.model';
import { SettingsService } from '../../../core/services/settings.service';

interface CategoryPanel {
  category: SettingCategory;
  form: FormGroup<Record<string, FormControl<string>>>;
}

/** List-value items are edited as comma-separated text and split/joined at the edges. */
const LIST_SEPARATOR = ',';

@Component({
  selector: 'app-settings-list',
  templateUrl: './settings-list.component.html',
  styleUrls: ['./settings-list.component.scss'],
})
export class SettingsListComponent implements OnInit {
  panels: CategoryPanel[] = [];
  loading = true;
  reloading = false;
  saving: Record<string, boolean> = {};

  constructor(
    private readonly settings: SettingsService,
    private readonly fb: NonNullableFormBuilder,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  /** Secrets never arrive with a value — blank means "leave the stored secret alone". */
  fieldValue(item: SettingItem): string {
    if (item.isSecret) {
      return '';
    }
    if (item.isList) {
      return (item.value ?? '')
        .split(LIST_SEPARATOR)
        .map((part) => part.trim())
        .filter(Boolean)
        .join(', ');
    }
    return item.value ?? '';
  }

  save(panel: CategoryPanel): void {
    const values: Record<string, string | null> = {};

    for (const item of panel.category.items) {
      const control = panel.form.controls[item.key];
      if (!control.dirty) {
        continue;
      }
      if (item.isSecret && !control.value) {
        // Cleared, not filled in — don't wipe out an existing secret by accident.
        continue;
      }
      values[item.key] = item.isList
        ? control.value
            .split(LIST_SEPARATOR)
            .map((part) => part.trim())
            .filter(Boolean)
            .join(LIST_SEPARATOR)
        : control.value;
    }

    if (!Object.keys(values).length) {
      this.notify.info('No changes to save.');
      return;
    }

    const category = panel.category.category;
    this.saving = { ...this.saving, [category]: true };
    this.settings
      .update(category, values)
      .pipe(finalize(() => (this.saving = { ...this.saving, [category]: false })))
      .subscribe({
        next: () => {
          this.notify.success(`${category} settings saved.`);
          this.refreshCategory(category);
        },
      });
  }

  reload(): void {
    const data: ConfirmDialogData = {
      title: 'Reload configuration?',
      message:
        'This tells the API to re-read configuration from its store into the running process. ' +
        'It does not change any values.',
      confirmLabel: 'Reload',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.reloading = true;
        this.settings
          .reload()
          .pipe(finalize(() => (this.reloading = false)))
          .subscribe({
            next: () => this.notify.success('Configuration reloaded.'),
          });
      });
  }

  private load(): void {
    this.loading = true;
    this.settings.getAll().subscribe({
      next: (categories) => {
        this.panels = categories.map((category) => this.buildPanel(category));
        this.loading = false;
      },
      error: () => {
        this.panels = [];
        this.loading = false;
      },
    });
  }

  private refreshCategory(category: string): void {
    this.settings.getCategory(category).subscribe({
      next: (updated) => {
        const panel = this.buildPanel(updated);
        this.panels = this.panels.map((p) => (p.category.category === category ? panel : p));
      },
    });
  }

  private buildPanel(category: SettingCategory): CategoryPanel {
    const group: Record<string, FormControl<string>> = {};
    for (const item of category.items) {
      group[item.key] = this.fb.control(this.fieldValue(item));
    }
    return { category, form: this.fb.group(group) };
  }
}
