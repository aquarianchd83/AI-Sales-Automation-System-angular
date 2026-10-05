import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { PackageFormDialogComponent } from './package-form-dialog/package-form-dialog.component';
import { PackageSaleDialogComponent } from './package-sale-dialog/package-sale-dialog.component';
import { PackageListComponent } from './package-list/package-list.component';

const routes: Routes = [{ path: '', component: PackageListComponent }];

@NgModule({
  declarations: [PackageListComponent, PackageFormDialogComponent, PackageSaleDialogComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class PackagesModule {}
