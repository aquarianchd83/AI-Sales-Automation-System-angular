import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { finalize, switchMap } from 'rxjs/operators';

import {
  Customer,
  OptInStatus,
  customerDisplayName,
} from '../../../core/models/customer.model';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { CustomerFormDialogComponent } from '../customer-form-dialog/customer-form-dialog.component';
import { CustomerOptInDialogComponent } from '../customer-opt-in-dialog/customer-opt-in-dialog.component';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-customer-detail',
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.scss'],
})
export class CustomerDetailComponent implements OnInit {
  customer: Customer | null = null;
  loading = true;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly customers: CustomerService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.loading = true;
          return this.customers
            .getById(params.get('id') ?? '')
            .pipe(finalize(() => (this.loading = false)));
        })
      )
      .subscribe({
        next: (customer) => (this.customer = customer),
        error: () => (this.customer = null),
      });
  }

  get displayName(): string {
    return this.customer ? customerDisplayName(this.customer) : '';
  }

  get isOptedOut(): boolean {
    return this.customer?.optInStatus === OptInStatus.OptedOut;
  }

  get isOptedIn(): boolean {
    return this.customer?.optInStatus === OptInStatus.OptedIn;
  }

  optIn(): void {
    if (!this.customer) {
      return;
    }
    this.dialog
      .open(CustomerOptInDialogComponent, {
        data: { customer: this.customer },
        width: '480px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((updated) => {
        if (updated) {
          this.customer = updated;
        }
      });
  }

  statusClass(status: string | undefined): string {
    switch (status) {
      case OptInStatus.OptedIn:
        return 'status-chip status-chip--opted-in';
      case OptInStatus.OptedOut:
        return 'status-chip status-chip--opted-out';
      default:
        return 'status-chip status-chip--pending';
    }
  }

  edit(): void {
    if (!this.customer) {
      return;
    }
    this.dialog
      .open(CustomerFormDialogComponent, {
        data: { mode: 'edit', customer: this.customer },
        width: '640px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload();
        }
      });
  }

  optOut(): void {
    if (!this.customer) {
      return;
    }
    const data: ConfirmDialogData = {
      title: 'Opt this customer out?',
      message: `${this.displayName} will be excluded from all future automated messaging. This is a compliance action and is logged.`,
      confirmLabel: 'Opt out',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed && this.customer) {
          this.customers.optOut(this.customer.id).subscribe((updated) => {
            this.customer = updated;
            this.notify.success('Customer opted out.');
          });
        }
      });
  }

  delete(): void {
    if (!this.customer) {
      return;
    }
    const data: ConfirmDialogData = {
      title: 'Delete this customer?',
      message: `${this.displayName} will be removed from the list. The backend soft-deletes the record, so message history is preserved.`,
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed && this.customer) {
          this.customers.delete(this.customer.id).subscribe(() => {
            this.notify.success('Customer deleted.');
            void this.router.navigate(['/customers']);
          });
        }
      });
  }

  private reload(): void {
    if (!this.customer) {
      return;
    }
    this.loading = true;
    this.customers
      .getById(this.customer.id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((customer) => (this.customer = customer));
  }
}
