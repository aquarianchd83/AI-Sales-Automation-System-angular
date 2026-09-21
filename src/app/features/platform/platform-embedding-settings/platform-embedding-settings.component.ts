import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { finalize } from 'rxjs/operators';

import { SettingItem } from '../../../core/models/settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformEmbeddingStatus, PlatformKnowledgeService } from '../../../core/services/platform-knowledge.service';
import { SettingsService } from '../../../core/services/settings.service';

const PROVIDER = 'AiProviders:EmbeddingProvider';
const OPENAI_MODEL = 'AiProviders:OpenAI:EmbeddingModel';
const OPENAI_KEY = 'AiProviders:OpenAI:ApiKey';
const GOOGLE_MODEL = 'AiProviders:Google:EmbeddingModel';
const GOOGLE_KEY = 'AiProviders:Google:ApiKey';

/**
 * Which embedding provider, model and API key the PLATFORM uses to index its own Knowledge Base
 * articles. Stored in the database (the AiProviders settings category) rather than appsettings.json;
 * secrets are encrypted at rest and never shown again - a blank key field keeps the stored one.
 */
@Component({
  selector: 'app-platform-embedding-settings',
  templateUrl: './platform-embedding-settings.component.html',
  styleUrls: ['./platform-embedding-settings.component.scss'],
})
export class PlatformEmbeddingSettingsComponent implements OnInit {
  readonly providers = ['Simulated', 'OpenAI', 'Google'];

  readonly form = this.fb.nonNullable.group({
    provider: 'Simulated',
    openAiModel: '',
    openAiKey: '',
    googleModel: '',
    googleKey: '',
  });

  items = new Map<string, SettingItem>();
  status: PlatformEmbeddingStatus | null = null;
  loading = true;
  loadFailed = false;
  saving = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly settings: SettingsService,
    private readonly knowledge: PlatformKnowledgeService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  /** "Key set (••••abcd)" hint for a secret, or null when none is stored. */
  keyHint(key: string): string | null {
    const item = this.items.get(key);
    return item?.hasValue ? item.valueHint ?? 'set' : null;
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.settings
      .getCategory('AiProviders')
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (category) => {
          this.items = new Map(category.items.map((i) => [i.key, i]));
          this.form.reset({
            provider: this.items.get(PROVIDER)?.value || 'Simulated',
            openAiModel: this.items.get(OPENAI_MODEL)?.value ?? '',
            openAiKey: '',
            googleModel: this.items.get(GOOGLE_MODEL)?.value ?? '',
            googleKey: '',
          });
          this.refreshStatus();
        },
        error: () => (this.loadFailed = true),
      });
  }

  save(): void {
    if (this.saving || this.form.pristine) {
      return;
    }

    const raw = this.form.getRawValue();
    const values: Record<string, string | null> = {
      [PROVIDER]: raw.provider,
      [OPENAI_MODEL]: raw.openAiModel.trim(),
      [GOOGLE_MODEL]: raw.googleModel.trim(),
    };
    // A blank key field means "keep what is stored" - only a typed value replaces it.
    if (raw.openAiKey.trim()) {
      values[OPENAI_KEY] = raw.openAiKey.trim();
    }
    if (raw.googleKey.trim()) {
      values[GOOGLE_KEY] = raw.googleKey.trim();
    }

    this.saving = true;
    this.settings
      .update('AiProviders', values)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.notify.success('Embedding settings saved. Re-index the platform Knowledge Base to apply them to existing articles.');
          this.load();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
  }

  private refreshStatus(): void {
    this.knowledge.getEmbeddingStatus().subscribe({
      next: (s) => (this.status = s),
      error: () => (this.status = null),
    });
  }
}
