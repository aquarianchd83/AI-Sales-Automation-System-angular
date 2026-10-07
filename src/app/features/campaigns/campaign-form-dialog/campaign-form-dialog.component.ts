import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, startWith, switchMap } from 'rxjs/operators';

import { Campaign, toScheduledStartAtRequest, toTimeInputValue } from '../../../core/models/campaign.model';
import { Customer, customerDisplayName } from '../../../core/models/customer.model';
import { MessageTemplate, WhatsAppTemplateStatus } from '../../../core/models/message-template.model';
import { Tag } from '../../../core/models/tag.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { CustomerService } from '../../../core/services/customer.service';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TagService } from '../../../core/services/tag.service';

export interface CampaignFormDialogData {
  mode: 'create' | 'edit';
  campaign?: Campaign;
}

interface AudienceChip {
  id: string;
  label: string;
}

@Component({
  selector: 'app-campaign-form-dialog',
  templateUrl: './campaign-form-dialog.component.html',
  styleUrls: ['./campaign-form-dialog.component.scss'],
})
export class CampaignFormDialogComponent implements OnInit {
  readonly isEdit = this.data.mode === 'edit';
  /** The API rejects a scheduled start in the past — only enforced on create. */
  readonly today = new Date();

  private readonly existingScheduledStartAt = this.data.campaign?.scheduledStartAt
    ? new Date(this.data.campaign.scheduledStartAt)
    : null;

  readonly form = this.fb.nonNullable.group({
    name: [this.data.campaign?.name ?? '', [Validators.required, Validators.maxLength(200)]],
    description: [this.data.campaign?.description ?? '', [Validators.maxLength(2000)]],
    scheduledStartAt: [this.existingScheduledStartAt as Date | null],
    /** "HH:mm" — see toTimeInputValue/toScheduledStartAtRequest. Defaults to midnight so a
     * date picked with the time left untouched still schedules exactly as it did before
     * this field existed. */
    scheduledStartTime: [this.existingScheduledStartAt ? toTimeInputValue(this.existingScheduledStartAt) : '00:00'],
    /** The Initial message. Asked for on create only - afterwards steps are edited on the campaign itself. */
    messageTemplateId: [null as string | null, this.isEdit ? [] : [Validators.required]],
  });

  // A campaign with nobody to message and nothing to say does nothing, so creating one asks for both up front
  // (follow-ups and anything more are added on the campaign afterwards).
  readonly customerSearch = new FormControl('', { nonNullable: true });
  readonly tagSearch = new FormControl('', { nonNullable: true });
  templates: MessageTemplate[] = [];
  loadingTemplates = !this.isEdit;
  /** Set once the template list has come back, so "none yet" is not shown while it is still loading. */
  templatesLoaded = false;
  customerOptions: Customer[] = [];
  tagOptions: Tag[] = [];
  loadingCustomers = false;
  /** Null until the first look at the customer list; 0 means there is nobody to message yet. */
  totalCustomers: number | null = null;
  selectedCustomers: AudienceChip[] = [];
  selectedTags: string[] = [];

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CampaignFormDialogData,
    private readonly fb: FormBuilder,
    private readonly campaigns: CampaignService,
    private readonly customers: CustomerService,
    private readonly tags: TagService,
    private readonly templateService: MessageTemplateService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<CampaignFormDialogComponent, boolean>
  ) {}

  ngOnInit(): void {
    if (this.isEdit) {
      return;
    }

    // Only a template Meta has approved (and that is switched on) can actually be sent, and Start refuses anything
    // else - so those are the only ones offered.
    this.templateService
      .getPaged({ page: 1, pageSize: 100 })
      .pipe(
        finalize(() => {
          this.loadingTemplates = false;
          this.templatesLoaded = true;
        })
      )
      .subscribe({
        next: (page) =>
          (this.templates = page.items.filter((t) => t.isActive && t.whatsAppTemplateStatus === WhatsAppTemplateStatus.Approved)),
        error: () => (this.templates = []),
      });

    this.customerSearch.valueChanges
      .pipe(
        startWith(''),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((search) => {
          this.loadingCustomers = true;
          return this.customers.getPaged({ page: 1, pageSize: 10, search: search || undefined }).pipe(
            catchError(() => of(null)),
            finalize(() => (this.loadingCustomers = false))
          );
        })
      )
      .subscribe((page) => {
        this.customerOptions = page?.items ?? [];
        if (page && !this.customerSearch.value && this.totalCustomers === null) {
          this.totalCustomers = page.totalCount;
        }
      });

    this.tagSearch.valueChanges
      .pipe(
        startWith(''),
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((search) =>
          this.tags.getPaged({ page: 1, pageSize: 10, search: search || undefined }).pipe(catchError(() => of(null)))
        )
      )
      .subscribe((page) => (this.tagOptions = page?.items ?? []));
  }

  get selectedTemplate(): MessageTemplate | null {
    const id = this.form.controls.messageTemplateId.value;
    return (id && this.templates.find((t) => t.id === id)) || null;
  }

  get noTemplates(): boolean {
    return this.templatesLoaded && this.templates.length === 0;
  }

  get noCustomers(): boolean {
    return this.totalCustomers === 0;
  }

  get hasAudience(): boolean {
    return this.selectedCustomers.length > 0 || this.selectedTags.length > 0;
  }

  /** Creating needs a message and somebody to send it to; editing is only the details. */
  get canSave(): boolean {
    return this.isEdit || (this.form.valid && this.hasAudience);
  }

  onCustomerSelected(event: MatAutocompleteSelectedEvent): void {
    const customer = event.option.value as Customer;
    if (!this.selectedCustomers.some((c) => c.id === customer.id)) {
      this.selectedCustomers = [
        ...this.selectedCustomers,
        { id: customer.id, label: `${customerDisplayName(customer)} (${customer.phoneNumberE164})` },
      ];
    }
    this.customerSearch.setValue('');
  }

  removeCustomer(id: string): void {
    this.selectedCustomers = this.selectedCustomers.filter((c) => c.id !== id);
  }

  onTagSelected(event: MatAutocompleteSelectedEvent): void {
    const tag = event.option.value as Tag;
    if (!this.selectedTags.includes(tag.name)) {
      this.selectedTags = [...this.selectedTags, tag.name];
    }
    this.tagSearch.setValue('');
  }

  removeTag(name: string): void {
    this.selectedTags = this.selectedTags.filter((t) => t !== name);
  }

  save(): void {
    if (this.saving || !this.canSave) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const request = {
      name: raw.name.trim(),
      description: raw.description.trim() || null,
      scheduledStartAt: raw.scheduledStartAt
        ? toScheduledStartAtRequest(raw.scheduledStartAt, raw.scheduledStartTime)
        : null,
    };

    if (this.isEdit && this.data.campaign) {
      this.saving = true;
      this.campaigns
        .update(this.data.campaign.id, request)
        .pipe(finalize(() => (this.saving = false)))
        .subscribe({
          next: () => {
            this.notify.success('Campaign updated.');
            this.dialogRef.close(true);
          },
          error: () => {
            // ErrorInterceptor toasts it (e.g. editing a campaign that left Draft in another tab).
          },
        });
      return;
    }

    this.saving = true;
    this.campaigns.create(request).subscribe({
      next: (campaign) => this.attachMessageAndAudience(campaign, raw.messageTemplateId!),
      error: () => {
        this.saving = false; // ErrorInterceptor toasts why
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  /** The campaign exists from here on. If its message or audience then fails to attach, it stays as a Draft with
   * whatever did go through, and the person is told what is still missing rather than losing the campaign. */
  private attachMessageAndAudience(campaign: Campaign, messageTemplateId: string): void {
    this.campaigns
      .upsertStep(campaign.id, {
        stepType: 'Initial',
        delayDaysAfterPrevious: 0,
        messageTemplateId,
        mediaAssetIds: [],
        isActive: true,
      })
      .pipe(
        switchMap(() =>
          this.campaigns.setAudience(campaign.id, {
            tagNames: this.selectedTags,
            customerIds: this.selectedCustomers.map((c) => c.id),
          })
        ),
        finalize(() => (this.saving = false))
      )
      .subscribe({
        next: (result) => {
          if (result.addedCount > 0) {
            this.notify.success(`Campaign created with ${result.addedCount} customer${result.addedCount === 1 ? '' : 's'}.`);
          } else {
            this.notify.info('Campaign created, but nobody was added - the matching customers are not opted in yet.');
          }
          this.dialogRef.close(true);
        },
        error: () => {
          this.notify.error(
            'The campaign was created as a draft, but its message or audience could not be added. Open it to finish setting it up.'
          );
          this.dialogRef.close(true);
        },
      });
  }
}
