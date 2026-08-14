import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import {
  Customer,
  OPT_IN_SOURCE_MAX_LENGTH,
  customerDisplayName,
} from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';

export interface CustomerOptInDialogData {
  customer: Customer;
}

/** Common ways consent gets captured; the field stays free-text for anything else. */
const SUGGESTED_SOURCES = ['WebForm', 'WhatsApp', 'PaperForm', 'PhoneCall', 'InStore'];

@Component({
  selector: 'app-customer-opt-in-dialog',
  templateUrl: './customer-opt-in-dialog.component.html',
  styles: [
    `
      .full-width {
        width: 100%;
      }
      .intro {
        margin: 0 0 16px;
        font-size: 13px;
      }
      .suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: -4px 0 14px;
      }
    `,
  ],
})
export class CustomerOptInDialogComponent {
  readonly suggestedSources = SUGGESTED_SOURCES;
  readonly maxSourceLength = OPT_IN_SOURCE_MAX_LENGTH;
  readonly displayName = customerDisplayName(this.data.customer);
  /** The API rejects a future consent date, so the picker cannot offer one. */
  readonly today = new Date();

  readonly form = this.fb.nonNullable.group({
    source: [
      '',
      [Validators.required, Validators.maxLength(OPT_IN_SOURCE_MAX_LENGTH)],
    ],
    capturedAt: [null as Date | null],
  });

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CustomerOptInDialogData,
    private readonly fb: FormBuilder,
    private readonly customers: CustomerService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CustomerOptInDialogComponent, Customer | undefined>
  ) {}

  useSuggestion(source: string): void {
    this.form.controls.source.setValue(source);
    this.form.controls.source.markAsDirty();
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const { source, capturedAt } = this.form.getRawValue();
    this.saving = true;
    this.customers
      .optIn(this.data.customer.id, {
        source: source.trim(),
        // Omitted rather than sent as null when blank — the server defaults to now.
        capturedAt: capturedAt ? capturedAt.toISOString() : undefined,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (customer) => {
          this.notify.success(`${this.displayName} is now opted in.`);
          this.dialogRef.close(customer);
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
