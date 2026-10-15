import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { CustomerHistoryEvent, customerHistoryEventLabel } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';

export interface CustomerHistoryDialogData {
  /** The customer whose history is fetched. Omit when `events` is given. */
  customerId?: string;
  /** A history the opener already has - for a business that never became a customer. Nothing is fetched. */
  events?: CustomerHistoryEvent[];
  /** Shown in the dialog; the customer's name, or whatever the opener has to call them. */
  displayName: string;
}

/** A customer's processing timeline, oldest first - discovery today, verification, campaign, SMS and consent as they are built. */
@Component({
  selector: 'app-customer-history-dialog',
  templateUrl: './customer-history-dialog.component.html',
  styleUrls: ['./customer-history-dialog.component.scss'],
})
export class CustomerHistoryDialogComponent implements OnInit {
  readonly displayName = this.data.displayName;
  readonly label = customerHistoryEventLabel;

  events: CustomerHistoryEvent[] = [];
  loading = true;
  failed = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CustomerHistoryDialogData,
    private readonly customers: CustomerService,
    private readonly dialogRef: MatDialogRef<CustomerHistoryDialogComponent>
  ) {}

  ngOnInit(): void {
    if (this.data.events || !this.data.customerId) {
      this.events = this.data.events ?? [];
      this.loading = false;
      return;
    }

    this.customers
      .getHistory(this.data.customerId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (events) => (this.events = events),
        error: () => (this.failed = true),
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}
