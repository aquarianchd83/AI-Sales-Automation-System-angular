import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { TenantWhatsAppConfig, UpdateTenantWhatsAppConfigRequest } from '../../../core/models/tenant-settings.model';
import { PlatformTenantConfigService } from '../../../core/services/platform-tenant-config.service';

export interface PlatformTenantWhatsAppConfigDialogData {
  tenantId: string;
  tenantName: string;
  config: TenantWhatsAppConfig | null;
}

/** The Platform Admin's editor for one tenant's WhatsApp Business connection - the same form the tenant's own
 * Settings page uses (the connection is owned jointly), scoped by tenantId. Closes with true when anything was
 * saved or verified, so the tenant detail screen reloads. */
@Component({
  selector: 'app-platform-tenant-whatsapp-config-dialog',
  templateUrl: './platform-tenant-whatsapp-config-dialog.component.html',
})
export class PlatformTenantWhatsAppConfigDialogComponent {
  config: TenantWhatsAppConfig | null = this.data.config;
  private changed = false;

  readonly save = (request: UpdateTenantWhatsAppConfigRequest) => this.configService.saveWhatsAppConfig(this.data.tenantId, request);
  readonly verify = () => this.configService.verifyWhatsAppConfig(this.data.tenantId);

  constructor(
    private readonly configService: PlatformTenantConfigService,
    private readonly dialogRef: MatDialogRef<PlatformTenantWhatsAppConfigDialogComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public readonly data: PlatformTenantWhatsAppConfigDialogData
  ) {}

  onChanged(config: TenantWhatsAppConfig): void {
    this.config = config;
    this.changed = true;
  }

  close(): void {
    this.dialogRef.close(this.changed);
  }
}
