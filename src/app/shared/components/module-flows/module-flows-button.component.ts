import { Component, Input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { FlowDocKey, ModuleFlowsDialogComponent, ModuleFlowsDialogData } from './module-flows-dialog.component';

/**
 * "How it works" button for a module's page header - opens that module's FLOWS.md flowcharts.
 * Admin only: the docs name backend files and list known bugs, which is internal detail.
 * Admin is the tenant's administrator role. There is no SuperAdmin role in this system - the roles
 * are Admin, SalesManager, SalesAgent and PlatformSuperAdmin - so gating on that name renders for
 * nobody, which is exactly what this button did until it was spotted missing on screen.
 * Like every *appHasRole use this hides the button, not the files - assets/flows is still fetchable.
 */
@Component({
  selector: 'app-module-flows-button',
  template: `
    <button
      *appHasRole="['Admin']"
      mat-stroked-button
      type="button"
      matTooltip="Flowcharts of how this module works"
      (click)="open()"
    >
      <mat-icon>account_tree</mat-icon>
      How it works
    </button>
  `,
})
export class ModuleFlowsButtonComponent {
  @Input() module: FlowDocKey = 'overview';

  constructor(private readonly dialog: MatDialog) {}

  open(): void {
    this.dialog.open<ModuleFlowsDialogComponent, ModuleFlowsDialogData>(ModuleFlowsDialogComponent, {
      data: { module: this.module },
      width: '1000px',
      maxWidth: '95vw',
      height: '90vh',
      autoFocus: false,
    });
  }
}
