import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { ApplicationSetup, AvailablePlan, PlanApplication } from '../../../core/models/application-setup.model';
import { ApplicationService } from '../../../core/services/application.service';
import { CurrencySymbolService } from '../../../core/services/currency-symbol.service';

export interface ChangePlanDialogData {
  application: PlanApplication;
}

@Component({
  selector: 'app-change-plan-dialog',
  templateUrl: './change-plan-dialog.component.html',
  styleUrls: ['../new-application-dialog/new-application-dialog.component.scss'],
})
export class ChangePlanDialogComponent implements OnInit {
  plans: AvailablePlan[] = [];
  selected: AvailablePlan | null = null;
  currencySymbol = '';
  loading = true;
  saving = false;

  readonly reason = new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] });

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: ChangePlanDialogData,
    private readonly service: ApplicationService,
    private readonly currency: CurrencySymbolService,
    private readonly dialogRef: MatDialogRef<ChangePlanDialogComponent, ApplicationSetup>
  ) {}

  ngOnInit(): void {
    this.currency.get().subscribe((symbol) => (this.currencySymbol = symbol));
    this.service
      .getPlans()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((plans) => (this.plans = plans.filter((p) => p.planId !== this.data.application.planId)));
  }

  select(plan: AvailablePlan): void {
    this.selected = plan;
  }

  change(): void {
    if (!this.selected || this.reason.invalid) {
      return;
    }
    this.saving = true;
    this.service
      .changePlan(this.data.application.id, this.selected.planId, this.reason.value.trim())
      .pipe(finalize(() => (this.saving = false)))
      .subscribe((setup) => this.dialogRef.close(setup));
  }
}
