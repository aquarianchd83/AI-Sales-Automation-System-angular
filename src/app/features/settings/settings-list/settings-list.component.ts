import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, NonNullableFormBuilder } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from '../../../core/services/notification.service';
import { AiProviderCheck, SettingCategory, SettingItem } from '../../../core/models/settings.model';
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
  /** The provider whose Verify is running, or null. */
  verifying: string | null = null;
  /** The last Verify result per provider name ("Anthropic", "OpenAI", "Google"); cleared when the page reloads. */
  checks: Record<string, AiProviderCheck> = {};

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

  /** Only the AI Providers screen has providers to verify. */
  get canVerify(): boolean {
    return !!this.only?.includes('AiProviders');
  }

  /** True for a card that is one provider's connection (Anthropic, OpenAI, Google) rather than the shared General settings. */
  verifiable(group: SettingGroup): boolean {
    return this.canVerify && ['Anthropic', 'OpenAI', 'Google'].includes(group.name);
  }

  /** Verifies one provider's SAVED key, so a pending edit has to be saved first. */
  verify(provider: string): void {
    if (this.verifying) {
      return;
    }
    if (this.panels.some((p) => p.groups.some((g) => g.name === provider && this.groupDirty(p, g)))) {
      this.notify.info('Save your changes first - Verify tests the saved key.');
      return;
    }
    this.verifying = provider;
    this.settings
      .verifyAiProviders(provider)
      .pipe(finalize(() => (this.verifying = null)))
      .subscribe({
        next: (results) => {
          const check = results.find((r) => r.provider === provider);
          if (!check) {
            return;
          }
          this.checks = { ...this.checks, [provider]: check };
          if (check.success) {
            this.notify.success(check.message);
          } else if (check.configured) {
            this.notify.error(check.message);
          } else {
            this.notify.info(check.message);
          }
        },
      });
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

  /** Saves the changed fields of the whole category, or - when a card's own Save is pressed - only that card's (`group`). */
  save(panel: CategoryPanel, group?: SettingGroup): void {
    const values: Record<string, string | null> = {};

    for (const item of group?.items ?? panel.category.items) {
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
    const busy = this.savingKey(panel, group);
    this.saving = { ...this.saving, [busy]: true };
    this.settings
      .update(category, values)
      .pipe(finalize(() => (this.saving = { ...this.saving, [busy]: false })))
      .subscribe({
        next: () => {
          this.notify.success(`${group ? group.name : category} settings saved.`);
          // Edits in the other cards are still unsaved: carry them across the reload.
          const kept = group ? this.dirtyValues(panel, group) : {};
          this.refreshCategory(category, kept);
        },
      });
  }

  /** The key of `saving` for a whole category or one card of it. */
  savingKey(panel: CategoryPanel, group?: SettingGroup): string {
    return group ? `${panel.category.category}:${group.name}` : panel.category.category;
  }

  /** True when any field in the card has been edited and not saved. */
  groupDirty(panel: CategoryPanel, group: SettingGroup): boolean {
    return group.items.some((item) => panel.form.controls[item.key]?.dirty);
  }

  /** The edited values outside `group`, to put back after the category reloads. */
  private dirtyValues(panel: CategoryPanel, group: SettingGroup): Record<string, string> {
    const inGroup = new Set(group.items.map((i) => i.key));
    const kept: Record<string, string> = {};
    for (const [key, control] of Object.entries(panel.form.controls)) {
      if (!inGroup.has(key) && control.dirty) {
        kept[key] = control.value;
      }
    }
    return kept;
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

  private refreshCategory(category: string, keep: Record<string, string> = {}): void {
    this.settings.getCategory(category).subscribe({
      next: (updated) => {
        const panel = this.buildPanel(updated);
        for (const [key, value] of Object.entries(keep)) {
          panel.form.controls[key]?.setValue(value);
          panel.form.controls[key]?.markAsDirty();
        }
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
