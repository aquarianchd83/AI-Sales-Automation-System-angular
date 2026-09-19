import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { AbstractControl } from '@angular/forms';

import { IndianState } from '../../../core/models/billing.model';
import { BillingService } from '../../../core/services/billing.service';

/**
 * The state picker shown beside a country picker - only where the country's tax splits by state (India). The state decides
 * whether the tenant pays CGST + SGST (same state as the platform) or IGST, so it belongs wherever a tenant's country is set.
 * It renders nothing for any other country, and clears the chosen state when the country changes to one without states.
 */
@Component({
  selector: 'app-state-select',
  template: `
    <mat-form-field *ngIf="states.length" class="full-width" subscriptSizing="dynamic">
      <mat-label>State</mat-label>
      <mat-select [formControl]="$any(control)">
        <mat-option [value]="''">Not set</mat-option>
        <mat-option *ngFor="let state of states" [value]="state.code">{{ state.name }}</mat-option>
      </mat-select>
      <mat-hint>Decides whether GST is CGST + SGST or IGST on what you pay.</mat-hint>
    </mat-form-field>
  `,
})
export class StateSelectComponent implements OnChanges {
  @Input() control!: AbstractControl;
  @Input() country: string | null | undefined;

  states: IndianState[] = [];

  constructor(private readonly billing: BillingService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['country']) {
      return;
    }

    if (!this.country) {
      this.states = [];
      return;
    }

    this.billing.getStates(this.country).subscribe({
      next: (states) => {
        this.states = states;
        if (!states.length && this.control?.value) {
          this.control.setValue('');
        }
      },
      error: () => (this.states = []),
    });
  }
}
