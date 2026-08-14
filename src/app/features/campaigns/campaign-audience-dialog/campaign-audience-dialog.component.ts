import { Component, Inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs/operators';

import { Campaign, SetCampaignAudienceResult } from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { Customer, customerDisplayName } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { Tag } from '../../../core/models/tag.model';
import { TagService } from '../../../core/services/tag.service';

export interface CampaignAudienceDialogData {
  campaign: Campaign;
}

interface CustomerChip {
  id: string;
  label: string;
}

@Component({
  selector: 'app-campaign-audience-dialog',
  templateUrl: './campaign-audience-dialog.component.html',
  styleUrls: ['./campaign-audience-dialog.component.scss'],
})
export class CampaignAudienceDialogComponent {
  readonly tagSearchControl = new FormControl('', { nonNullable: true });
  readonly customerSearchControl = new FormControl('', { nonNullable: true });

  tagOptions: Tag[] = [];
  customerOptions: Customer[] = [];
  loadingTagOptions = false;
  loadingCustomerOptions = false;

  selectedTags: string[] = [];
  selectedCustomers: CustomerChip[] = [];

  submitting = false;
  result: SetCampaignAudienceResult | null = null;
  /** True once anything was written, so the list behind the dialog needs a refresh. */
  private touchedData = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CampaignAudienceDialogData,
    private readonly campaigns: CampaignService,
    private readonly tags: TagService,
    private readonly customers: CustomerService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CampaignAudienceDialogComponent, boolean>
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
      .subscribe((page) => (this.tagOptions = page.items));

    this.customerSearchControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((search) => {
          this.loadingCustomerOptions = true;
          return this.customers
            .getPaged({ page: 1, pageSize: 10, search: search || undefined })
            .pipe(finalize(() => (this.loadingCustomerOptions = false)));
        })
      )
      .subscribe((page) => (this.customerOptions = page.items));
  }

  get canSubmit(): boolean {
    return this.selectedTags.length > 0 || this.selectedCustomers.length > 0;
  }

  onTagSelected(event: MatAutocompleteSelectedEvent): void {
    const tag = event.option.value as Tag;
    if (!this.selectedTags.includes(tag.name)) {
      this.selectedTags = [...this.selectedTags, tag.name];
    }
    this.tagSearchControl.setValue('');
  }

  removeTag(name: string): void {
    this.selectedTags = this.selectedTags.filter((t) => t !== name);
  }

  onCustomerSelected(event: MatAutocompleteSelectedEvent): void {
    const customer = event.option.value as Customer;
    if (!this.selectedCustomers.some((c) => c.id === customer.id)) {
      this.selectedCustomers = [
        ...this.selectedCustomers,
        { id: customer.id, label: `${customerDisplayName(customer)} (${customer.phoneNumberE164})` },
      ];
    }
    this.customerSearchControl.setValue('');
  }

  removeCustomer(id: string): void {
    this.selectedCustomers = this.selectedCustomers.filter((c) => c.id !== id);
  }

  submit(): void {
    if (!this.canSubmit || this.submitting) {
      return;
    }

    this.submitting = true;
    this.campaigns
      .setAudience(this.data.campaign.id, {
        tagNames: this.selectedTags,
        customerIds: this.selectedCustomers.map((c) => c.id),
      })
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: (result) => {
          this.result = result;
          this.touchedData = result.addedCount > 0;
          this.notify.success(`${result.addedCount} customer${result.addedCount === 1 ? '' : 's'} added.`);
        },
        error: () => {
          // ErrorInterceptor toasts it (e.g. the campaign became Stopped/Completed meanwhile).
        },
      });
  }

  addMore(): void {
    this.result = null;
    this.selectedTags = [];
    this.selectedCustomers = [];
  }

  close(): void {
    this.dialogRef.close(this.touchedData);
  }
}
