import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { AvailablePlan, PlanApplication } from '../../../core/models/application-setup.model';
import { ApplicationService } from '../../../core/services/application.service';
import { CurrencySymbolService } from '../../../core/services/currency-symbol.service';

/** Pick the plan a new application runs on. What it will ask is shown up front, so there are no surprises. */
@Component({
  selector: 'app-new-application-dialog',
  templateUrl: './new-application-dialog.component.html',
  styleUrls: ['./new-application-dialog.component.scss'],
})
export class NewApplicationDialogComponent implements OnInit {
  plans: AvailablePlan[] = [];
  selected: AvailablePlan | null = null;
  currencySymbol = '';
  loading = true;
  saving = false;

  readonly name = new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(150)] });

  constructor(
    private readonly service: ApplicationService,
    private readonly currency: CurrencySymbolService,
    private readonly dialogRef: MatDialogRef<NewApplicationDialogComponent, PlanApplication>
  ) {}

  ngOnInit(): void {
    this.currency.get().subscribe((symbol) => (this.currencySymbol = symbol));
    this.service
      .getPlans()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((plans) => {
        this.plans = plans;
        this.selected = plans.length === 1 ? plans[0] : null;
      });
  }

  select(plan: AvailablePlan): void {
    this.selected = plan;
  }

  create(): void {
    if (!this.selected || this.name.invalid) {
      return;
    }
    this.saving = true;
    this.service
      .create(this.selected.planId, this.name.value.trim())
      .pipe(finalize(() => (this.saving = false)))
      .subscribe((created) => this.dialogRef.close(created));
  }
}
