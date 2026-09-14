import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { PlatformTenantDetail } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';

/** Operator-initiated tenant creation — the Platform Admin Console's counterpart to self-serve
 * signup. Mirrors UserFormDialogComponent's shape (a temporary password set by the creator, shown/
 * hidden with the same toggle), not the public signup form, since the PlatformSuperAdmin is setting
 * up the account for someone else rather than signing themselves up. */
@Component({
  selector: 'app-platform-tenant-form-dialog',
  templateUrl: './platform-tenant-form-dialog.component.html',
  styles: [
    `
      .note {
        margin: 8px 0 0;
        font-size: 12px;
      }
    `,
  ],
})
export class PlatformTenantFormDialogComponent {
  readonly form = this.fb.nonNullable.group({
    companyName: ['', [Validators.required, Validators.maxLength(200)]],
    slug: ['', [Validators.pattern('^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')]],
    adminFullName: ['', [Validators.required, Validators.maxLength(200)]],
    adminEmail: ['', [Validators.required, Validators.email]],
    adminPassword: ['', [Validators.required, Validators.minLength(8)]],
  });

  hidePassword = true;
  saving = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly tenants: PlatformTenantService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PlatformTenantFormDialogComponent, PlatformTenantDetail | false>
  ) {}

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.saving = true;
    this.tenants
      .create({
        companyName: raw.companyName.trim(),
        slug: raw.slug.trim() || null,
        adminFullName: raw.adminFullName.trim(),
        adminEmail: raw.adminEmail.trim(),
        adminPassword: raw.adminPassword,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (tenant) => {
          this.notify.success(`${tenant.name} created.`);
          this.dialogRef.close(tenant);
        },
        error: () => {
          /* ErrorInterceptor toasts it; keep the dialog open */
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
