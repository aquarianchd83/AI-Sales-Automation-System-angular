import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { CustomerDetailComponent } from './customer-detail/customer-detail.component';
import { CustomerFormDialogComponent } from './customer-form-dialog/customer-form-dialog.component';
import { CustomerImportDialogComponent } from './customer-import-dialog/customer-import-dialog.component';
import { CustomerListComponent } from './customer-list/customer-list.component';
import { CustomerOptInDialogComponent } from './customer-opt-in-dialog/customer-opt-in-dialog.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [
  { path: '', component: CustomerListComponent },
  { path: ':id', component: CustomerDetailComponent },
];

@NgModule({
  declarations: [
    CustomerListComponent,
    CustomerDetailComponent,
    CustomerFormDialogComponent,
    CustomerImportDialogComponent,
    CustomerOptInDialogComponent,
  ],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class CustomersModule {}
