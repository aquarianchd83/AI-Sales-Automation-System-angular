import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { NotificationService } from '../../core/services/notification.service';

interface SetupStatus {
  setupRequired: boolean;
  setupEnabled: boolean;
}

/**
 * First-run page (/setup): creates the very first platform super admin on a fresh database
 * (POST /setup/super-admin). The API only accepts it while no super admin exists and only with the
 * server's Setup:BootstrapKey, so once the account is made this page just points at the sign-in.
 */
@Component({
  selector: 'app-setup',
  templateUrl: './setup.component.html',
  styleUrls: ['./setup.component.scss'],
})
export class SetupComponent implements OnInit {
  private readonly baseUrl = `${environment.apiBaseUrl}/setup`;

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.maxLength(200)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    bootstrapKey: ['', Validators.required],
  });

  status: SetupStatus | null = null;
  statusFailed = false;
  hidePassword = true;
  submitting = false;
  done = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly http: HttpClient,
    private readonly router: Router,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.http.get<SetupStatus>(`${this.baseUrl}/status`).subscribe({
      next: (status) => (this.status = status),
      error: () => (this.statusFailed = true),
    });
  }

  submit(): void {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting = true;
    this.http
      .post<void>(`${this.baseUrl}/super-admin`, this.form.getRawValue())
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: () => {
          this.done = true;
          this.notify.success('Platform super admin created. You can sign in now.');
          void this.router.navigateByUrl('/login');
        },
        // 403 (wrong key / setup off), 409 (already set up) and validation errors come through
        // ErrorInterceptor's toast.
      });
  }
}
