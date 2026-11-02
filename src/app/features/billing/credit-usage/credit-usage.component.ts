import { Component, OnInit } from '@angular/core';

import { BillingService } from '../../../core/services/billing.service';
import { TenantProfileService } from '../../../core/services/tenant-profile.service';
import {
  CreditHistoryLedgerSource,
  CreditHistorySummarySource,
  CreditHistoryTestChatSource,
} from '../../../shared/components/credit-history/credit-history.component';

/** This workspace's credit history: what was added to its wallet and what was spent, with stat tiles, a graph and a date filter. */
@Component({
  selector: 'app-credit-usage',
  templateUrl: './credit-usage.component.html',
  styleUrls: ['./credit-usage.component.scss'],
})
export class CreditUsageComponent implements OnInit {
  readonly fetchLedger: CreditHistoryLedgerSource = (query) => this.billing.getLedger(query);
  readonly fetchSummary: CreditHistorySummarySource = (days, filter) => this.billing.getLedgerSummary(days, filter);
  /** Test chat replies, free, listed apart from the credit movements. */
  readonly fetchTestChat: CreditHistoryTestChatSource = (query) => this.billing.getTestChat(query);

  /** The workspace's own time zone: the API splits the history into days by it, so the times shown must be in it too. */
  timezone: string | null = null;

  constructor(
    private readonly billing: BillingService,
    private readonly tenantProfile: TenantProfileService
  ) {}

  ngOnInit(): void {
    this.tenantProfile.getProfile().subscribe({
      next: (profile) => (this.timezone = profile.timezone ?? null),
      error: () => undefined,
    });
  }
}
