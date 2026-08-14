import { Component, Inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AppRole, Role, USER_ADMIN_ROLES, User } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';

export interface UserRolesDialogData {
  user: User;
  roles: Role[];
}

@Component({
  selector: 'app-user-roles-dialog',
  templateUrl: './user-roles-dialog.component.html',
  styles: [
    `
      .role-option {
        display: block;
        margin: 6px 0;
      }
      .warning {
        margin: 12px 0 0;
        font-size: 12px;
      }
    `,
  ],
})
export class UserRolesDialogComponent {
  readonly control = new FormControl<string[]>(this.data.user.roles ?? [], {
    nonNullable: true,
  });

  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: UserRolesDialogData,
    private readonly users: UserService,
    private readonly auth: AuthService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<UserRolesDialogComponent, boolean>
  ) {}

  /**
   * True when the signed-in admin is about to strip their own admin access — the
   * API would accept it and they would lose this screen on the next page load.
   */
  get isSelfDemotion(): boolean {
    const isSelf = this.auth.currentUser?.id === this.data.user.id;
    const keepsAdmin = this.control.value.some((role) => USER_ADMIN_ROLES.includes(role));
    return isSelf && !keepsAdmin;
  }

  isChecked(roleName: string): boolean {
    return this.control.value.includes(roleName);
  }

  toggle(roleName: string, checked: boolean): void {
    const next = checked
      ? [...this.control.value, roleName]
      : this.control.value.filter((role) => role !== roleName);
    this.control.setValue(next);
  }

  describe(roleName: string): string {
    switch (roleName) {
      case AppRole.SuperAdmin:
        return 'Full access, including system configuration and the Hangfire dashboard.';
      case AppRole.Admin:
        return 'Manages users, customers, campaigns and knowledge base content.';
      case AppRole.SalesManager:
        return 'Oversees leads, agents and campaign performance.';
      case AppRole.SalesAgent:
        return 'Handles assigned conversations and leads.';
      default:
        return '';
    }
  }

  save(): void {
    if (this.saving) {
      return;
    }
    this.saving = true;
    this.users
      .assignRoles(this.data.user.id, this.control.value)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.notify.success('Roles updated.');
          this.dialogRef.close(true);
        },
        error: () => {
          /* ErrorInterceptor toasts it */
        },
      });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
