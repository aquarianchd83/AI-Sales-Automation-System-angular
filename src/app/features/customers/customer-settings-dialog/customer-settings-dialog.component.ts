import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';

/** The tenant's customer settings: is consent required before a customer can be messaged? Decides the status new customers start in. */
@Component({
  selector: 'app-customer-settings-dialog',
  templateUrl: './customer-settings-dialog.component.html',
})
export class CustomerSettingsDialogComponent implements OnInit {
  consentRequired = false;
  loading = true;
  saving = false;

  constructor(
    private readonly customers: CustomerService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CustomerSettingsDialogComponent, boolean | undefined>
  ) {}

  ngOnInit(): void {
    this.customers
      .getConsentSetting()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (setting) => (this.consentRequired = setting.consentRequired),
        error: () => {
          /* ErrorInterceptor toasts it */
        },
      });
  }

  /** The status a customer created now would start in, for the hint under the switch. */
  get newCustomerStatus(): string {
    return this.consentRequired ? 'Waiting for consent' : 'Pending opt-in';
  }

  save(): void {
    if (this.saving || this.loading) {
      return;
    }
    this.saving = true;
    this.customers
      .setConsentSetting(this.consentRequired)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.notify.success('Customer settings saved.');
          this.dialogRef.close(true);
        },
        error: () => {
          /* ErrorInterceptor toasts it; keep the dialog open */
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }
}
