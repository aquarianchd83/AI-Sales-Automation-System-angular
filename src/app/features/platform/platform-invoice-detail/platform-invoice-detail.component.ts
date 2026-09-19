import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { formatCharge } from '../../../core/models/billing.model';
import {
  INVOICE_STATUS_LABELS,
  InvoiceLineItem,
  InvoiceStatus,
  PlatformInvoiceDetail,
  formatInvoicePeriod,
  formatInvoicePeriodRange,
  invoiceLineItems,
} from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformInvoiceService } from '../../../core/services/platform-invoice.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-platform-invoice-detail',
  templateUrl: './platform-invoice-detail.component.html',
  styleUrls: ['./platform-invoice-detail.component.scss'],
})
export class PlatformInvoiceDetailComponent implements OnInit {
  readonly statusLabels = INVOICE_STATUS_LABELS;
  readonly InvoiceStatus = InvoiceStatus;
  readonly formatCharge = formatCharge;
  readonly formatInvoicePeriod = formatInvoicePeriod;
  readonly formatInvoicePeriodRange = formatInvoicePeriodRange;

  invoice: PlatformInvoiceDetail | null = null;
  lineItems: InvoiceLineItem[] = [];
  loading = true;
  markingPaid = false;

  private invoiceId!: string;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly invoices: PlatformInvoiceService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.invoiceId = this.route.snapshot.paramMap.get('id') ?? '';
    this.load();
  }

  markPaid(): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Mark this invoice as paid?',
          message: `${this.invoice?.tenantName}'s ${this.invoice ? formatInvoicePeriod(this.invoice.periodStartUtc) : ''} invoice will be recorded as settled. There is no way to undo this from here.`,
          confirmLabel: 'Mark as paid',
        },
        width: '460px',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed || this.markingPaid) {
          return;
        }
        this.markingPaid = true;
        this.invoices
          .markPaid(this.invoiceId)
          .pipe(finalize(() => (this.markingPaid = false)))
          .subscribe((invoice) => {
            this.notify.success('Invoice marked as paid.');
            this.applyInvoice(invoice);
          });
      });
  }

  private load(): void {
    this.loading = true;
    this.invoices.getById(this.invoiceId).subscribe({
      next: (invoice) => {
        this.applyInvoice(invoice);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        void this.router.navigate(['/platform/invoices']);
      },
    });
  }

  private applyInvoice(invoice: PlatformInvoiceDetail): void {
    this.invoice = invoice;
    this.lineItems = invoiceLineItems(invoice);
  }
}
