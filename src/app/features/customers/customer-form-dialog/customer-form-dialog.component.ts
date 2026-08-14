import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, Inject } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { Observable, forkJoin, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';

import { Customer } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Tag } from '../../../core/models/tag.model';
import { TagService } from '../../../core/services/tag.service';
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

  /** The immutable initial snapshot — never mutated; removedTags tracks what's staged off it. */
  readonly existingTags: string[] = [...(this.data.customer?.tags ?? [])];
  /** Staged in this dialog and still removable until saved. */
  newTags: string[] = [];
  /** Existing tags staged for removal — applied via a separate call per tag on save. */
  removedTags: string[] = [];

  readonly tagSearchControl = new FormControl('', { nonNullable: true });
  tagOptions: Tag[] = [];
  loadingTagOptions = false;

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CustomerFormDialogData,
    private readonly fb: FormBuilder,
    private readonly customers: CustomerService,
    private readonly tags: TagService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CustomerFormDialogComponent, boolean>
  ) {
    this.tagSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((search) => {
          this.loadingTagOptions = true;
          return this.tags
            .getPaged({ page: 1, pageSize: 10, search: search || undefined })
            .pipe(finalize(() => (this.loadingTagOptions = false)));
        })
      )
      .subscribe((page) => {
        // Don't suggest a tag that's already attached (and not staged for removal) or
        // already staged as new — a removed one is fair to suggest again, since picking
        // it just cancels the removal (see stageTag).
        this.tagOptions = page.items.filter(
          (tag) => !this.visibleExistingTags.includes(tag.name) && !this.newTags.includes(tag.name)
        );
      });
  }

  /** Existing tags not currently staged for removal — what the chip list actually shows. */
  get visibleExistingTags(): string[] {
    return this.existingTags.filter((t) => !this.removedTags.includes(t));
  }

  /** Free-text entry — Enter or comma commits whatever was typed, existing tag or new. */
  addTag(event: MatChipInputEvent): void {
    this.stageTag((event.value || '').trim());
    event.chipInput?.clear();
    this.tagSearchControl.setValue('');
  }

  /** Picking a suggestion from the autocomplete dropdown. */
  onTagOptionSelected(event: MatAutocompleteSelectedEvent): void {
    const tag = event.option.value as Tag;
    this.stageTag(tag.name);
    this.tagSearchControl.setValue('');
  }

  removeNewTag(tag: string): void {
    this.newTags = this.newTags.filter((t) => t !== tag);
  }

  /** Stages an already-attached tag for removal on save; reversible via undoRemoveTag. */
  removeExistingTag(tag: string): void {
    if (!this.removedTags.includes(tag)) {
      this.removedTags = [...this.removedTags, tag];
    }
  }

  undoRemoveTag(tag: string): void {
    this.removedTags = this.removedTags.filter((t) => t !== tag);
  }

  private stageTag(name: string): void {
    if (!name) {
      return;
    }
    if (this.removedTags.includes(name)) {
      // Re-typing/re-selecting a tag just staged for removal simply cancels the removal
      // — cleaner than staging a redundant remove-then-re-add round trip on save.
      this.undoRemoveTag(name);
      return;
    }
    if (!this.existingTags.includes(name) && !this.newTags.includes(name)) {
      this.newTags.push(name);
    }
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
        // Tags are separate endpoints — CreateCustomerRequest/UpdateCustomerRequest don't
        // accept them. Removals first (independent, safe in parallel), then the single
        // additions call — so a tag that was removed and re-typed in the same session
        // (see stageTag) ends up attached, not stuck mid-toggle.
        switchMap((customer) => {
          // Typed as Observable<unknown> — its emission is never used, only its
          // completion. Left to inference, the ternary's two branches (Observable<
          // Customer[]> vs Observable<null>) confuse the switchMap overload below.
          const removals$: Observable<unknown> = this.removedTags.length
            ? forkJoin(this.removedTags.map((name) => this.customers.removeTag(customer.id, name)))
            : of(null);
          return removals$.pipe(
            switchMap(() =>
              this.newTags.length ? this.customers.addTags(customer.id, this.newTags) : of(customer)
            )
          );
        }),
        finalize(() => (this.saving = false))
      )
      .subscribe({
        next: () => {
          this.notify.success(this.isEdit ? 'Customer updated.' : 'Customer created.');
          this.dialogRef.close(true);
        },
        error: () => {
          // ErrorInterceptor toasts it. The customer, and possibly some tag changes, may
          // already have been saved even though this call failed — refresh the list
          // either way on close so the caller sees the real current state.
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
