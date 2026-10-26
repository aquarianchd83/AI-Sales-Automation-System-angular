import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { WhatsAppProviderSettings } from '../../../core/models/platform-whatsapp-provider.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWhatsAppProviderService } from '../../../core/services/platform-whatsapp-provider.service';

/**
 * The Platform Admin Console's WhatsApp provider selector: which integration the platform offers tenants. Only the choice is stored here -
 * no secrets. A provider whose adapter is not built yet is listed but disabled, so an invalid choice cannot be saved from this screen; the
 * server refuses it too and keeps the active provider as it was.
 */
@Component({
  selector: 'app-platform-whatsapp-provider',
  templateUrl: './platform-whatsapp-provider.component.html',
  styleUrls: ['./platform-whatsapp-provider.component.scss'],
})
export class PlatformWhatsAppProviderComponent implements OnInit {
  current: WhatsAppProviderSettings | null = null;
  /** What the radio currently shows; differs from `current.active` until saved. */
  selected = '';
  loading = true;
  loadFailed = false;
  saving = false;

  constructor(
    private readonly providers: PlatformWhatsAppProviderService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get pristine(): boolean {
    return !this.current || this.selected === this.current.active;
  }

  get activeName(): string {
    return this.current?.providers.find((p) => p.id === this.current?.active)?.name ?? this.current?.active ?? '';
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.providers
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (settings) => this.apply(settings),
        error: () => (this.loadFailed = true),
      });
  }

  save(): void {
    if (this.pristine || this.saving) {
      return;
    }
    this.saving = true;
    this.providers
      .save(this.selected)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (settings) => {
          this.apply(settings);
          this.notify.success(`WhatsApp provider is now ${this.activeName}.`);
        },
        // The server kept the previous provider, so put the radio back to what is really active.
        error: () => {
          this.selected = this.current?.active ?? '';
          this.notify.error('The WhatsApp provider was not changed.');
        },
      });
  }

  discard(): void {
    this.selected = this.current?.active ?? '';
  }

  private apply(settings: WhatsAppProviderSettings): void {
    this.current = settings;
    this.selected = settings.active;
  }
}
