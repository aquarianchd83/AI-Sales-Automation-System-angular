import { Component, Inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { Role, User } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';

export interface UserFormDialogData {
  mode: 'create' | 'edit';
  user?: User;
  roles: Role[];
}

@Component({
  selector: 'app-user-form-dialog',
  templateUrl: './user-form-dialog.component.html',
  styles: [
    `
      .active-toggle {
        display: block;
        margin: 4px 0 8px;
      }
      .note {
        margin: 8px 0 0;
        font-size: 12px;
      }
    `,
  ],
})
export class UserFormDialogComponent {
  readonly isEdit = this.data.mode === 'edit';

  readonly form = this.fb.nonNullable.group({
    fullName: [this.data.user?.fullName ?? '', [Validators.required]],
    // The API's UpdateUserRequest has no email field, so it is disabled when editing.
    email: [
      { value: this.data.user?.email ?? '', disabled: this.isEdit },
      [Validators.required, Validators.email],
    ],
    phoneNumber: [this.data.user?.phoneNumber ?? ''],
    // CreateUserRequest has no isActive — new users are created active — so this
    // only applies when editing.
    isActive: [this.data.user?.isActive ?? true],
    password: [
      '',
      this.data.mode === 'create' ? [Validators.required, Validators.minLength(6)] : [],
    ],
    roles: [this.data.user?.roles ?? ([] as string[])],
  });

  hidePassword = true;
  saving = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: UserFormDialogData,
    private readonly fb: FormBuilder,
    private readonly users: UserService,
    private readonly notify: NotificationService,
    private readonly dialogRef: MatDialogRef<UserFormDialogComponent, boolean>
  ) {}

  save(): void {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const save$: Observable<User> =
      this.isEdit && this.data.user
        ? this.users.update(this.data.user.id, {
            fullName: raw.fullName.trim(),
            phoneNumber: raw.phoneNumber.trim() || null,
            isActive: raw.isActive,
          })
        : this.users.create({
            fullName: raw.fullName.trim(),
            email: raw.email.trim(),
            phoneNumber: raw.phoneNumber.trim() || null,
            password: raw.password,
            roles: raw.roles,
          });

    this.saving = true;
    save$.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.notify.success(this.isEdit ? 'User updated.' : 'User created.');
        this.dialogRef.close(true);
      },
      error: () => {
        /* ErrorInterceptor toasts it; keep the dialog open */
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
