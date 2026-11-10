import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { CreditScenario } from '../../../core/models/credit-payer.model';
import { ServiceMarginByPack, ServiceMarginPack, ServiceMarginRow, ServiceMargins, creditsPerUnitFor, onPack, previewRow } from '../../../core/models/service-margin.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformServiceMarginService } from '../../../core/services/platform-service-margin.service';

/**
 * Service margins: for each service a tenant is charged for (an AI conversation, a discovered customer, a WhatsApp message) what it costs the
 * platform, the credits it draws, and the margin that leaves - once for each credit pack, because a credit is worth what the pack it was bought in
 * sold it for (₹2.49 in a small pack, less in a big one).
 *
 * The cost is worked out by the API and is never typed. The only thing set here is how many credits a service draws; the margins follow as it is
 * typed. Nothing applies until it is saved, and a new charge applies to what happens next - past charges keep what they were.
 */
@Component({
  selector: 'app-platform-service-margins',
  templateUrl: './platform-service-margins.component.html',
  styleUrls: ['./platform-service-margins.component.scss'],
})
export class PlatformServiceMarginsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  data: ServiceMargins | null = null;
  loading = true;
  failed = false;
  saving = false;

  /** Credits per unit, one control per service, keyed by its scenario. */
  readonly credits = new FormGroup({});

  /** What a unit costs in rupees, typed, for the services whose cost the platform cannot work out. Keyed by scenario; empty means none. */
  readonly costs = new FormGroup({});

  /** The rows as the form currently has them: the saved cost, with the charge and margins of the credits being typed. */
  rows: ServiceMarginRow[] = [];
  columns: string[] = ['service', 'cost', 'credits'];

  /** Keyed by service, so a row keeps its input (and its focus) while the numbers beside it change. */
  readonly trackByScenario = (_: number, row: ServiceMarginRow): number => row.scenario;

  constructor(
    private readonly margins: PlatformServiceMarginService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.credits.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshRows());
    this.costs.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => this.refreshRows());
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.failed = false;
    this.margins
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data) => this.show(data),
        error: () => (this.failed = true),
      });
  }

  get packs(): ServiceMarginPack[] {
    return this.data?.packs ?? [];
  }

  get dirty(): boolean {
    return this.credits.dirty || this.costs.dirty;
  }

  costControl(row: ServiceMarginRow): FormControl<number | null> | undefined {
    return (this.costs.get(String(row.scenario)) as FormControl<number | null> | null) ?? undefined;
  }

  creditsControl(row: ServiceMarginRow): FormControl<number | null> | undefined {
    return (this.credits.get(String(row.scenario)) as FormControl<number | null> | null) ?? undefined;
  }

  forPack(row: ServiceMarginRow, pack: ServiceMarginPack): ServiceMarginByPack | undefined {
    return onPack(row, pack);
  }

  /** A cost that is more than the charge: the platform loses money on every one. */
  isLoss(entry: ServiceMarginByPack | undefined): boolean {
    return !!entry && entry.marginInr !== null && entry.marginInr < 0;
  }

  /** The packs a service loses money on, for the line under it. */
  lossPacks(row: ServiceMarginRow): ServiceMarginPack[] {
    return this.packs.filter((pack) => this.isLoss(this.forPack(row, pack)));
  }

  lossNames(row: ServiceMarginRow): string {
    return this.lossPacks(row)
      .map((pack) => pack.name)
      .join(' and ');
  }

  save(): void {
    if (!this.data || this.credits.invalid || this.costs.invalid || this.saving) {
      this.credits.markAllAsTouched();
      this.costs.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.margins
      .update({
        charges: this.data.rows.map((row) => ({ scenario: row.scenario, creditsPerUnit: creditsPerUnitFor(row, this.creditsControl(row)!.value ?? 0) })),
        manualCosts: this.data.rows
          .filter((row) => row.costEditable)
          .map((row) => ({ scenario: row.scenario, costInr: this.typedCost(row) ?? null })),
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe((data) => {
        this.show(data);
        this.notify.success('Charges saved. They apply to what happens next.');
      });
  }

  discard(): void {
    if (this.data) {
      this.show(this.data);
    }
  }

  private refreshRows(): void {
    if (!this.data) {
      this.rows = [];
      return;
    }
    // The per-step Content Studio generation row is not shown: what a studio video costs is the video render row. Its saved cost and credits still
    // travel with the form (see `save`), so hiding the row never changes them.
    this.rows = this.data.rows.filter((row) => row.scenario !== CreditScenario.ContentStudioGeneration).map((row) => {
      const typed = this.creditsControl(row)?.value;
      return previewRow(row, this.data!.packs, typed == null || Number.isNaN(typed) ? row.creditsCharged : typed, row.costEditable ? this.typedCost(row) : undefined);
    });
  }

  /** The cost typed for a row: a number, or null when the box is empty. */
  private typedCost(row: ServiceMarginRow): number | null | undefined {
    const typed = this.costControl(row)?.value;
    return typed == null || Number.isNaN(typed) ? null : typed;
  }

  private show(data: ServiceMargins): void {
    this.data = data;
    this.columns = ['service', 'cost', 'credits', ...data.packs.map((pack) => 'pack-' + pack.id)];
    Object.keys(this.credits.controls).forEach((key) => this.credits.removeControl(key));
    data.rows.forEach((row) =>
      this.credits.addControl(String(row.scenario), new FormControl<number | null>(row.creditsCharged, [Validators.required, Validators.min(0), Validators.max(100000)]))
    );
    this.credits.markAsPristine();

    Object.keys(this.costs.controls).forEach((key) => this.costs.removeControl(key));
    data.rows
      .filter((row) => row.costEditable)
      .forEach((row) => this.costs.addControl(String(row.scenario), new FormControl<number | null>(row.costInr, [Validators.min(0), Validators.max(1000000)])));
    this.costs.markAsPristine();
    this.refreshRows();
  }
}
