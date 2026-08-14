import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatChipInputEvent } from '@angular/material/chips';
import { Observable, of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';

import { Customer } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { normalizePhoneNumber, phoneNumberValidator } from '../../../core/utils/phone-number';

export interface CustomerFormDialogData {
  mode: 'create' | 'edit';
  customer?: Customer;
}

@Component({
  selector: 'app-customer-form-dialog',
  templateUrl: './customer-form-dialog.component.html',
  styleUrls: ['./customer-form-dialog.component.scss'],
})
export class CustomerFormDialogComponent {
  readonly separatorKeysCodes = [ENTER, COMMA] as const;
  readonly isEdit = this.data.mode === 'edit';

  readonly form = this.fb.nonNullable.group({
    phoneNumberE164: [
      this.data.customer?.phoneNumberE164 ?? '',
      [Validators.required, phoneNumberValidator],
    ],
    firstName: [this.data.customer?.firstName ?? ''],
    lastName: [this.data.customer?.lastName ?? ''],
    email: [this.data.customer?.email ?? '', [Validators.email]],
    source: [this.data.customer?.source ?? ''],
    preferredLanguage: [this.data.customer?.preferredLanguage ?? ''],
  });

  /**
   * The E.164 form the typed number will be stored as, shown as a hint so the +91 an
   * Indian number picks up is never a surprise. Null while the input is unusable.
   */
  get normalizedPhone(): string | null {
    const typed = this.form.controls.phoneNumberE164.value;
    const normalized = normalizePhoneNumber(typed);
    return normalized && normalized !== typed.trim() ? normalized : null;
  }

  /** Already persisted; the API has no remove-tag endpoint, so these are read-only. */
  readonly existingTags: string[] = [...(this.data.customer?.tags ?? [])];
  /** Staged in this dialog and still removable until saved. */
  newTags: string[] = [];

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CustomerFormDialogData,
    private readonly fb: FormBuilder,
    private readonly customers: CustomerService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CustomerFormDialogComponent, boolean>
  ) {}

  addTag(event: MatChipInputEvent): void {
    const value = (event.value || '').trim();
    if (value && !this.existingTags.includes(value) && !this.newTags.includes(value)) {
      this.newTags.push(value);
    }
    event.chipInput?.clear();
  }

  removeNewTag(tag: string): void {
    this.newTags = this.newTags.filter((t) => t !== tag);
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request = {
      // Send the normalized form. The API normalizes anyway, but this keeps what the
      // user was shown in the hint identical to what gets stored.
      phoneNumberE164: normalizePhoneNumber(raw.phoneNumberE164) ?? raw.phoneNumberE164.trim(),
      firstName: raw.firstName.trim() || null,
      lastName: raw.lastName.trim() || null,
      email: raw.email.trim() || null,
      source: raw.source.trim() || null,
      preferredLanguage: raw.preferredLanguage.trim() || null,
    };

    const saved$: Observable<Customer> =
      this.isEdit && this.data.customer
        ? this.customers.update(this.data.customer.id, request)
        : this.customers.create(request);

    this.saving = true;
    saved$
      .pipe(
        // Tags are a separate endpoint — CreateCustomerRequest does not accept them.
        switchMap((customer) =>
          this.newTags.length
            ? this.customers.addTags(customer.id, this.newTags)
            : of(customer)
        ),
        finalize(() => (this.saving = false))
      )
      .subscribe({
        next: () => {
          this.notify.success(this.isEdit ? 'Customer updated.' : 'Customer created.');
          this.dialogRef.close(true);
        },
        error: () => {
          // ErrorInterceptor toasts it. The customer may already have been saved and
          // only the tag call failed, so refresh the list either way on close.
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
