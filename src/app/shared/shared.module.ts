import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { CreditCostComponent } from './components/credit-cost/credit-cost.component';
import { StateSelectComponent } from './components/state-select/state-select.component';
import { PageHeaderComponent } from './components/page-header/page-header.component';
import { ModuleFlowsButtonComponent } from './components/module-flows/module-flows-button.component';
import { ModuleFlowsDialogComponent } from './components/module-flows/module-flows-dialog.component';
import { HasRoleDirective } from './directives/has-role.directive';
import { InViewportDirective } from './directives/in-viewport.directive';
import { MaterialModule } from './material.module';
import { ZonedDatePipe } from './pipes/zoned-date.pipe';
import { CustomerHistoryDialogComponent } from './components/customer-history-dialog/customer-history-dialog.component';
import { TenantJobsDialogComponent } from './components/tenant-jobs-dialog/tenant-jobs-dialog.component';
import { TenantJobListComponent } from './components/tenant-job-list/tenant-job-list.component';
import { TenantJobScheduleDialogComponent } from './components/tenant-job-schedule-dialog/tenant-job-schedule-dialog.component';
import { MetaConnectCardComponent } from './components/meta-connect-card/meta-connect-card.component';
import { QuestionnaireFormComponent } from './components/questionnaire-form/questionnaire-form.component';
import { PlatformWalletTopUpDialogComponent } from './components/platform-wallet-top-up-dialog/platform-wallet-top-up-dialog.component';
import { WhatsAppConnectionFormComponent } from './components/whatsapp-connection-form/whatsapp-connection-form.component';

const DECLARATIONS = [
  ConfirmDialogComponent,
  CreditCostComponent,
  PageHeaderComponent,
  StateSelectComponent,
  HasRoleDirective,
  InViewportDirective,
  ModuleFlowsButtonComponent,
  ModuleFlowsDialogComponent,
  ZonedDatePipe,
  TenantJobListComponent,
  TenantJobsDialogComponent,
  CustomerHistoryDialogComponent,
  TenantJobScheduleDialogComponent,
  WhatsAppConnectionFormComponent,
  MetaConnectCardComponent,
  QuestionnaireFormComponent,
  PlatformWalletTopUpDialogComponent,
];

/** Re-exported building blocks for feature modules. Holds no providers. */
@NgModule({
  declarations: DECLARATIONS,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MaterialModule,
  ],
  exports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    MaterialModule,
    ...DECLARATIONS,
  ],
})
export class SharedModule {}
