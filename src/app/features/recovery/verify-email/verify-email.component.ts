import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { AccountRecoveryService } from '../../../core/services/account-recovery.service';
import { AuthService } from '../../../core/services/auth.service';

/** The landing page of the emailed "confirm your address" link: confirms on arrival and says how it went. */
@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  styleUrls: ['../recovery.scss'],
})
export class VerifyEmailComponent implements OnInit {
  state: 'checking' | 'confirmed' | 'failed' = 'checking';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly recovery: AccountRecoveryService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    const email = query.get('email') ?? '';
    const token = query.get('token') ?? '';
    if (!email || !token) {
      this.state = 'failed';
      return;
    }

    this.recovery.verifyEmail({ email, token }).subscribe({
      next: () => {
        this.state = 'confirmed';
        // Already signed in here? Drop the "confirm your email" banner without waiting for the next login.
        if (this.auth.currentUser?.email.toLowerCase() === email.toLowerCase()) {
          this.auth.patchCurrentUser({ emailConfirmed: true });
        }
      },
      error: () => (this.state = 'failed'),
    });
  }

  get signedIn(): boolean {
    return this.auth.isAuthenticated;
  }
}
