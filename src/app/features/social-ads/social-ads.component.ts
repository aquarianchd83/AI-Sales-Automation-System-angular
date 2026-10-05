import { Component, OnInit } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { ManualAdSpend, SocialAdsStatus, recentMonths, socialAdsRedirectUri, SOCIAL_ADS_PATH } from '../../core/models/social-ads.model';
import { SocialAdsGuideDialogComponent, SocialAdsGuideDialogData } from './social-ads-guide-dialog/social-ads-guide-dialog.component';
import { NotificationService } from '../../core/services/notification.service';
import { SocialAdsService } from '../../core/services/social-ads.service';

/** What Facebook sends back when the tenant cancels the login. */
const LOGIN_CANCELLED = 'The Facebook login was cancelled, so nothing was connected.';

@Component({
  selector: 'app-social-ads',
  templateUrl: './social-ads.component.html',
  styleUrls: ['./social-ads.component.scss'],
})
export class SocialAdsComponent implements OnInit {
  readonly months = recentMonths(new Date(), 24);
  readonly manualColumns = ['month', 'amount', 'actions'];
  /** Shown in the setup guide to copy into the Meta App: it must match what the connect button sends, character for character. */
  readonly redirectUri = socialAdsRedirectUri(window.location.origin);

  readonly manualForm = this.fb.nonNullable.group({
    month: [this.months[0], [Validators.required]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });
  readonly accountControl = this.fb.nonNullable.control('', [Validators.required]);

  status: SocialAdsStatus | null = null;
  manual: ManualAdSpend[] = [];
  loading = true;
  loadFailed = false;
  /** True while the page is finishing the Facebook login it was just redirected back from. */
  completing = false;
  busy = false;
  savingManual = false;
  message: string | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly socialAds: SocialAdsService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const code = params.get('code');
    const state = params.get('state');

    if (params.get('error')) {
      this.message = LOGIN_CANCELLED;
      this.clearQuery();
    } else if (code && state) {
      this.completeLogin(code, state);
      return;
    }

    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.socialAds
      .getStatus()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (status) => this.applyStatus(status),
        error: () => (this.loadFailed = true),
      });
    this.loadManual();
  }

  /** Sends the tenant to Facebook; they come back to this page with a one-time code. */
  connect(): void {
    this.busy = true;
    this.socialAds
      .getConnectUrl(socialAdsRedirectUri(window.location.origin))
      .pipe(finalize(() => (this.busy = false)))
      .subscribe({
        next: ({ url }) => window.location.assign(url),
        // ErrorInterceptor shows the API's message (for example, that the platform has no Meta App yet).
        error: () => undefined,
      });
  }

  useSelectedAccount(): void {
    if (this.accountControl.invalid || this.busy) {
      return;
    }
    this.busy = true;
    this.socialAds
      .selectAccount(this.accountControl.value)
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((status) => {
        this.applyStatus(status);
        this.notify.success('Ad account connected. Pulling your ad history now.');
      });
  }

  syncNow(): void {
    this.busy = true;
    this.socialAds
      .sync()
      .pipe(finalize(() => (this.busy = false)))
      .subscribe((status) => {
        this.applyStatus(status);
        this.notify.success(status.lastSyncError ? 'Sync finished with a problem — see the message below.' : 'Ad spend is up to date.');
      });
  }

  disconnect(): void {
    const data: ConfirmDialogData = {
      title: 'Disconnect Facebook & Instagram?',
      message:
        'We stop reading your ad spend and delete what we pulled from your ad account, including the saved login. ' +
        'Spend you typed in yourself is kept. You can connect again any time.',
      confirmLabel: 'Disconnect',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.socialAds.disconnect().subscribe(() => {
          this.notify.success('Disconnected.');
          this.load();
        });
      });
  }

  saveManual(): void {
    if (this.manualForm.invalid || this.savingManual) {
      this.manualForm.markAllAsTouched();
      return;
    }
    const { month, amount } = this.manualForm.getRawValue();
    this.savingManual = true;
    this.socialAds
      .saveManualSpend({ month, amount: Number(amount) })
      .pipe(finalize(() => (this.savingManual = false)))
      .subscribe(() => {
        this.notify.success('Ad spend saved.');
        this.manualForm.controls.amount.setValue(0);
        this.loadManual();
      });
  }

  clearManual(entry: ManualAdSpend): void {
    this.socialAds.saveManualSpend({ month: entry.month, amount: 0 }).subscribe(() => {
      this.notify.success('Removed.');
      this.loadManual();
    });
  }

  /** Opens the setup steps in a modal. `startOnSetup` lands on the one-time Meta app tab. */
  openGuide(startOnSetup = false): void {
    const data: SocialAdsGuideDialogData = { redirectUri: this.redirectUri, startOnSetup };
    this.dialog.open(SocialAdsGuideDialogComponent, { data, width: '820px', maxWidth: '95vw' });
  }

  /** True while there is something to show on the connected card (syncing happens daily by itself). */
  get isConnected(): boolean {
    return this.status?.status === 'Connected';
  }

  private completeLogin(code: string, state: string): void {
    this.completing = true;
    this.loading = false;
    this.socialAds
      .connect({ code, state, redirectUri: socialAdsRedirectUri(window.location.origin) })
      .pipe(finalize(() => (this.completing = false)))
      .subscribe({
        next: (status) => {
          this.clearQuery();
          this.applyStatus(status);
          this.loadManual();
          if (status.status === 'Connected') {
            this.notify.success('Connected. Your ad history is being pulled in.');
          }
        },
        error: () => {
          // ErrorInterceptor shows why (expired login, no ad account...). Drop the used-up code and show the page as it is.
          this.clearQuery();
          this.load();
        },
      });
  }

  private applyStatus(status: SocialAdsStatus): void {
    this.status = status;
    this.accountControl.setValue(status.accounts[0]?.id ?? '');
  }

  private loadManual(): void {
    this.socialAds.getManualSpend().subscribe({ next: (rows) => (this.manual = rows), error: () => (this.manual = []) });
  }

  /** The code in the address is single-use; leaving it there would make a refresh try to use it again. */
  private clearQuery(): void {
    void this.router.navigate([SOCIAL_ADS_PATH], { replaceUrl: true });
  }
}
