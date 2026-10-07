import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingCategory, SettingItem } from '../../../core/models/settings.model';
import { SettingsService } from '../../../core/services/settings.service';

interface SettingGroup {
  name: string;
  hint: string;
  items: SettingItem[];
}

interface CategoryPanel {
  category: SettingCategory;
  /** Built once per load - never in the template, where a fresh array each check would re-create the rows forever. */
  groups: SettingGroup[];
  form: FormGroup<Record<string, FormControl<string>>>;
}

/** Categories kept off this page. Most have a screen of their own, so a tab here would only be a second place to edit the same keys:
 * MediaStorage is "AWS Settings", App/Email/Sms are "SMTP/SMS Settings" and PlatformWhatsApp is "Platform WhatsApp". Razorpay and WhatsApp are
 * hidden here by request (Razorpay has its own screen, which asks for it by name) (the WhatsApp keys live on the Platform WhatsApp page). The API still serves all of them. */
const HIDDEN_CATEGORIES = ['MediaStorage', 'App', 'Email', 'Sms', 'PlatformWhatsApp', 'Razorpay', 'WhatsApp'];

/** Panel headings for a category's own keys on the grouped screens. */
const CATEGORY_LABELS: Record<string, string> = { AiProviders: 'General', MetaAds: 'Meta Ads', Ai: 'AI' };

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
  title = 'Configuration';

  /** True on a screen that shows chosen categories only (AI Providers): each category's keys are split into one panel per
   * sub-group (General, Anthropic, OpenAI, Google) instead of one long list. */
  get grouped(): boolean {
    return this.only !== null;
  }

  private readonly only: string[] | null;
  private readonly exclude: string[];

  constructor(
    route: ActivatedRoute,
    private readonly settings: SettingsService,
    private readonly fb: NonNullableFormBuilder,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {
    const data = route.snapshot?.data ?? {};
    this.title = data['title'] ?? this.title;
    this.only = data['categories'] ?? null;
    this.exclude = data['exclude'] ?? [];
  }

  ngOnInit(): void {
    this.load();
  }

  /** `AiProviders:OpenAI:ChatModel` belongs to the "OpenAI" panel; a two-part key like `AiProviders:Provider` belongs to the
   * category's own panel (named by CATEGORY_LABELS, listed first). */
  private groupsOf(category: SettingCategory): SettingGroup[] {
    if (!this.grouped) {
      return [{ name: category.category, hint: '', items: category.items }];
    }
    const own = CATEGORY_LABELS[category.category] ?? category.category;
    const groups = new Map<string, SettingItem[]>();
    for (const item of category.items) {
      const parts = item.key.split(':');
      const name = parts.length > 2 ? parts[1] : own;
      groups.set(name, [...(groups.get(name) ?? []), item]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a === own ? -1 : b === own ? 1 : 0))
      .map(([name, items]) => ({ name, hint: name === own ? '' : `Connection details for ${name}.`, items }));
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
        this.panels = categories
          .filter((category) => !HIDDEN_CATEGORIES.includes(category.category) || !!this.only?.includes(category.category))
          .filter((category) => !this.only || this.only.includes(category.category))
          .filter((category) => !this.exclude.includes(category.category))
          .map((category) => this.buildPanel(category));
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
    return { category, groups: this.groupsOf(category), form: this.fb.group(group) };
  }
}
