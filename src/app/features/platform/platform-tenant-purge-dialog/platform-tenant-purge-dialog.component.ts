import { Component, Inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { PlatformTenantService } from '../../../core/services/platform-tenant.service';

export interface PurgeTenantDialogData {
  id: string;
  name: string;
  slug: string;
}

/** The permanent counterpart to the list's Delete (a lock-out): removes the tenant, its users, configuration, background jobs and data.
 * The operator must type the slug, and the API checks it again. */
@Component({
  selector: 'app-platform-tenant-purge-dialog',
  template: `
    <h2 mat-dialog-title>Permanently delete {{ data.name }}?</h2>
    <mat-dialog-content>
      <p>
        This removes the tenant, all of its users, its configuration, its scheduled jobs and all of its data.
        <strong>It cannot be undone.</strong> The platform audit log keeps a record that it happened.
      </p>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Type {{ data.slug }} to confirm</mat-label>
        <input matInput [formControl]="confirm" autocomplete="off" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="busy" (click)="dialogRef.close(false)">Cancel</button>
      <button
        mat-flat-button
        color="warn"
        type="button"
        [disabled]="busy || confirm.value.trim() !== data.slug"
        (click)="purge()"
      >
        Delete permanently
      </button>
    </mat-dialog-actions>
  `,
  styles: ['.full { width: 100%; }'],
})
export class PlatformTenantPurgeDialogComponent {
  readonly confirm = new FormControl('', { nonNullable: true });
  busy = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: PurgeTenantDialogData,
    readonly dialogRef: MatDialogRef<PlatformTenantPurgeDialogComponent, boolean>,
    private readonly tenants: PlatformTenantService
  ) {}

  purge(): void {
    if (this.busy) {
      return;
    }
    this.busy = true;
    this.tenants
      .purge(this.data.id, this.confirm.value.trim())
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: () => this.dialogRef.close(true),
        error: () => {
          /* ErrorInterceptor toasts it; keep the dialog open */
        },
      });
  }
}
