import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { PageHeaderComponent } from './components/page-header/page-header.component';
import { ModuleFlowsButtonComponent } from './components/module-flows/module-flows-button.component';
import { ModuleFlowsDialogComponent } from './components/module-flows/module-flows-dialog.component';
import { HasRoleDirective } from './directives/has-role.directive';
import { MaterialModule } from './material.module';

const DECLARATIONS = [
  ConfirmDialogComponent,
  PageHeaderComponent,
  HasRoleDirective,
  ModuleFlowsButtonComponent,
  ModuleFlowsDialogComponent,
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
