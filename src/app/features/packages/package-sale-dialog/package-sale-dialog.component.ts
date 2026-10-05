import { Component, Inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';

import { Customer } from '../../../core/models/customer.model';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PackageService } from '../../../core/services/package.service';
import { SalesPackage } from '../../../core/models/package.model';

export interface PackageSaleDialogData {
  /** Only active packages are offered; the one clicked on the list is preselected. */
  packages: SalesPackage[];
  preselectedId?: string;
  currencySymbol: string;
}

export function customerLabel(customer: Customer): string {
  const name = `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim();
  return name ? `${name} (${customer.phoneNumberE164})` : customer.phoneNumberE164;
}

@Component({
  selector: 'app-package-sale-dialog',
  templateUrl: './package-sale-dialog.component.html',
  styleUrls: ['./package-sale-dialog.component.scss'],
})
export class PackageSaleDialogComponent implements OnInit, OnDestroy {
  readonly today = new Date();
  readonly label = customerLabel;

  readonly form = this.fb.group({
    packageId: [this.data.preselectedId ?? this.data.packages[0]?.id ?? '', [Validators.required]],
    amount: [this.priceOf(this.data.preselectedId ?? this.data.packages[0]?.id), [Validators.required, Validators.min(0)]],
    soldAt: [new Date() as Date | null, [Validators.required]],
  });
  /** Holds a search string while typing, then the chosen Customer (or null for "no customer"). */
  readonly customerControl = new FormControl<string | Customer>('', { nonNullable: true });

  customers: Customer[] = [];
  saving = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: PackageSaleDialogData,
    private readonly fb: FormBuilder,
    private readonly packages: PackageService,
    private readonly customerService: CustomerService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<PackageSaleDialogComponent, boolean>
  ) {}

  ngOnInit(): void {
    this.form.controls.packageId.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((id) => {
      // Switching package resets the amount to that package's price; the user can still discount it after.
      this.form.controls.amount.setValue(this.priceOf(id));
    });

    this.customerControl.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((value) => {
          const search = typeof value === 'string' ? value.trim() : '';
          if (typeof value !== 'string' || search.length < 2) {
            return of(null);
          }
          return this.customerService.getPaged({ page: 1, pageSize: 8, search }).pipe(catchError(() => of(null)));
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.customers = page?.items ?? []));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  displayCustomer = (value: string | Customer | null): string =>
    value && typeof value !== 'string' ? customerLabel(value) : '';

  clearCustomer(): void {
    this.customerControl.setValue('');
    this.customers = [];
  }

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const picked = this.customerControl.value;
    this.saving = true;
    this.packages
      .recordSale({
        packageId: value.packageId as string,
        customerId: typeof picked === 'string' || !picked ? null : picked.id,
        amount: Number(value.amount),
        soldAt: (value.soldAt as Date).toISOString(),
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.notify.success('Sale recorded.');
          this.dialogRef.close(true);
        },
        error: () => {
          // ErrorInterceptor shows the API's message (e.g. a future date) — keep the dialog open.
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }

  private priceOf(id: string | null | undefined): number {
    return this.data.packages.find((p) => p.id === id)?.price ?? 0;
  }
}
