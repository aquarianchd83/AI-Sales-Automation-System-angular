import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { Component, Inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatChipInputEvent } from '@angular/material/chips';
import { debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';

import { BULK_TAG_MAX_LENGTH, BULK_TAG_MAX_TAGS } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Tag } from '../../../core/models/tag.model';
import { TagService } from '../../../core/services/tag.service';

export interface CustomerBulkTagDialogData {
  /** The selected customers. */
  ids: string[];
}

/**
 * Adds the same tags to every selected customer in one request. Tags are picked from the tenant's existing ones or typed as new
 * ones (Enter or comma commits). Only adds - a customer that already has a tag keeps it and is not touched.
 */
@Component({
  selector: 'app-customer-bulk-tag-dialog',
  templateUrl: './customer-bulk-tag-dialog.component.html',
  styleUrls: ['./customer-bulk-tag-dialog.component.scss'],
})
export class CustomerBulkTagDialogComponent {
  readonly separatorKeysCodes = [ENTER, COMMA] as const;
  readonly maxTags = BULK_TAG_MAX_TAGS;
  readonly maxLength = BULK_TAG_MAX_LENGTH;

  readonly tagSearchControl = new FormControl('', { nonNullable: true });
  tagNames: string[] = [];
  tagOptions: Tag[] = [];
  loadingTagOptions = false;
  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CustomerBulkTagDialogData,
    private readonly customers: CustomerService,
    private readonly tags: TagService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CustomerBulkTagDialogComponent, boolean>
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
        this.tagOptions = page.items.filter((tag) => !this.has(tag.name));
      });
  }

  get customerCount(): number {
    return this.data.ids.length;
  }

  /** Free-text entry - Enter or comma commits what was typed. */
  addTag(event: MatChipInputEvent): void {
    this.stage((event.value || '').trim());
    event.chipInput?.clear();
    this.tagSearchControl.setValue('');
  }

  onTagOptionSelected(event: MatAutocompleteSelectedEvent): void {
    this.stage((event.option.value as Tag).name);
    this.tagSearchControl.setValue('');
  }

  remove(tag: string): void {
    this.tagNames = this.tagNames.filter((t) => t !== tag);
  }

  get canSave(): boolean {
    return !this.saving && (this.tagNames.length > 0 || this.tagSearchControl.value.trim().length > 0);
  }

  save(): void {
    // Something typed but not yet committed with Enter still counts - it would be surprising to lose it.
    this.stage(this.tagSearchControl.value.trim());
    this.tagSearchControl.setValue('');

    if (!this.tagNames.length || this.saving) {
      return;
    }

    this.saving = true;
    this.customers
      .bulkAddTags(this.data.ids, this.tagNames)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (result) => {
          const tags = result.tagNames.join(', ');
          const missed = result.notFoundIds.length;
          const skipped = result.requestedCount - result.updatedCount - missed;

          const parts = [`Tagged ${result.updatedCount} of ${result.requestedCount} customer${result.requestedCount === 1 ? '' : 's'} with ${tags}.`];
          if (skipped > 0) {
            parts.push(`${skipped} already had ${result.tagNames.length === 1 ? 'it' : 'all of them'}.`);
          }
          if (missed > 0) {
            parts.push(`${missed} no longer exist${missed === 1 ? 's' : ''}.`);
          }

          // A partial outcome is information, not a plain success.
          if (missed > 0) {
            this.notify.info(parts.join(' '));
          } else {
            this.notify.success(parts.join(' '));
          }
          this.dialogRef.close(true);
        },
        error: () => {
          // ErrorInterceptor toasts it; keep the dialog open so it can be retried.
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  private has(name: string): boolean {
    return this.tagNames.some((t) => t.toLowerCase() === name.toLowerCase());
  }

  private stage(name: string): void {
    if (!name) {
      return;
    }
    if (name.length > this.maxLength) {
      this.notify.error(`A tag can be at most ${this.maxLength} characters.`);
      return;
    }
    if (this.tagNames.length >= this.maxTags) {
      this.notify.error(`You can add at most ${this.maxTags} tags at once.`);
      return;
    }
    if (!this.has(name)) {
      this.tagNames = [...this.tagNames, name];
    }
  }
}
