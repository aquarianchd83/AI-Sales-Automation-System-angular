import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { PageEvent } from '@angular/material/paginator';
import { Subject } from 'rxjs';
import { finalize, takeUntil } from 'rxjs/operators';

import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { WalletTopUp, walletProviderLabel } from '../../../core/models/platform-wallet.model';
import { PlatformWalletService } from '../../../core/services/platform-wallet.service';
import { PlatformWalletTopUpDialogComponent } from '../../../shared/components/platform-wallet-top-up-dialog/platform-wallet-top-up-dialog.component';

/** The platform wallet's history: every top-up with its date, AI provider and amount, newest date first, plus the one balance they add up to. */
@Component({
  selector: 'app-platform-wallet',
  templateUrl: './platform-wallet.component.html',
  styleUrls: ['./platform-wallet.component.scss'],
})
export class PlatformWalletComponent implements OnInit, OnDestroy {
  readonly columns = ['date', 'provider', 'amount', 'added'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly providerLabel = walletProviderLabel;
  readonly summary$ = this.wallet.summary$;

  topUps: PagedResult<WalletTopUp> = emptyPage<WalletTopUp>();
  loading = true;

  private page = 1;
  private pageSize = DEFAULT_PAGE_SIZE;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly wallet: PlatformWalletService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.wallet.refresh();
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** A yyyy-MM-dd day as a local date, so it shows as that very day in any timezone. */
  dateOf(day: string): Date {
    const [year, month, date] = day.split('-').map(Number);
    return new Date(year, month - 1, date);
  }

  onPage(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.load();
  }

  addCredit(): void {
    this.dialog
      .open(PlatformWalletTopUpDialogComponent, { width: '440px', maxWidth: '95vw' })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe((added) => {
        if (added) {
          this.page = 1;
          this.load();
        }
      });
  }

  private load(): void {
    this.loading = true;
    this.wallet
      .getTopUps({ page: this.page, pageSize: this.pageSize })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (result) => (this.topUps = result), error: () => (this.topUps = emptyPage<WalletTopUp>(this.pageSize)) });
  }
}
