import { Component, Input, OnInit } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';

import { TenantWhatsAppProvider } from '../../../core/models/platform-whatsapp-provider.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWhatsAppProviderService } from '../../../core/services/platform-whatsapp-provider.service';

/** The empty choice: this tenant follows whatever the platform-wide provider is. */
export const FOLLOW_PLATFORM = 'default';

/**
 * Which WhatsApp connection one tenant uses, set by the Platform Admin: follow the platform-wide provider (the WhatsApp Provider page),
 * or pin this tenant to the Meta Cloud API or the QR code. The tenant's own WhatsApp Settings page shows exactly the matching setup.
 */
@Component({
  selector: 'app-platform-tenant-provider',
  templateUrl: './platform-tenant-provider.component.html',
  styleUrls: ['./platform-tenant-provider.component.scss'],
})
export class PlatformTenantProviderComponent implements OnInit {
  @Input() tenantId = '';

  readonly FOLLOW_PLATFORM = FOLLOW_PLATFORM;
  current: TenantWhatsAppProvider | null = null;
  selected = FOLLOW_PLATFORM;
  loading = true;
  loadFailed = false;
  saving = false;

  constructor(private readonly providers: PlatformWhatsAppProviderService, private readonly notify: NotificationService) {}

  ngOnInit(): void {
    this.load();
  }

  get pristine(): boolean {
    return !this.current || this.selected === (this.current.override ?? FOLLOW_PLATFORM);
  }

  nameOf(id: string | null | undefined): string {
    return id === 'QrBridge' ? 'QR code' : 'Meta Cloud API';
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.providers
      .getForTenant(this.tenantId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (p) => this.apply(p), error: () => (this.loadFailed = true) });
  }

  save(): void {
    if (this.pristine || this.saving) {
      return;
    }
    this.saving = true;
    this.providers
      .saveForTenant(this.tenantId, this.selected === FOLLOW_PLATFORM ? null : this.selected)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (p) => {
          this.apply(p);
          this.notify.success(`This tenant now uses the ${this.nameOf(p.effective)}.`);
        },
        error: (err: HttpErrorResponse) => {
          // The server kept the previous choice: show it again.
          this.selected = this.current?.override ?? FOLLOW_PLATFORM;
          const errors = err?.error?.errors as Record<string, string[]> | undefined;
          this.notify.error((errors ? Object.values(errors).flat()[0] : undefined) ?? err?.error?.detail ?? 'The WhatsApp provider was not changed.');
        },
      });
  }

  discard(): void {
    this.selected = this.current?.override ?? FOLLOW_PLATFORM;
  }

  private apply(p: TenantWhatsAppProvider): void {
    this.current = p;
    this.selected = p.override ?? FOLLOW_PLATFORM;
  }
}
