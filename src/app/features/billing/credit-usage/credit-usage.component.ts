import { Component } from '@angular/core';

import { BillingService } from '../../../core/services/billing.service';
import {
  CreditHistoryLedgerSource,
  CreditHistorySummarySource,
} from '../../../shared/components/credit-history/credit-history.component';

/** This workspace's credit history: what was added to its wallet and what was spent, with stat tiles, a graph and a date filter. */
@Component({
  selector: 'app-credit-usage',
  templateUrl: './credit-usage.component.html',
  styleUrls: ['./credit-usage.component.scss'],
})
export class CreditUsageComponent {
  readonly fetchLedger: CreditHistoryLedgerSource = (query) => this.billing.getLedger(query);
  readonly fetchSummary: CreditHistorySummarySource = (days, filter) => this.billing.getLedgerSummary(days, filter);

  constructor(private readonly billing: BillingService) {}
}
