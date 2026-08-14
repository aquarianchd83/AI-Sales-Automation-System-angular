import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { UserFormDialogComponent } from './user-form-dialog/user-form-dialog.component';
import { UserListComponent } from './user-list/user-list.component';
import { UserRolesDialogComponent } from './user-roles-dialog/user-roles-dialog.component';

const routes: Routes = [{ path: '', component: UserListComponent }];

@NgModule({
  declarations: [UserListComponent, UserFormDialogComponent, UserRolesDialogComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class UsersModule {}
