import { Component, OnInit } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { finalize } from 'rxjs/operators';

import { QUOTA_TYPE_LABELS, QuotaType } from '../../../core/models/billing.model';
import { TenantCreditUsage } from '../../../core/models/credit-payer.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { BillingService } from '../../../core/services/billing.service';

/** Where this workspace's credits went, and which actions the platform covered so they cost nothing from the workspace's balance.
 * Timestamps arrive as UTC with a trailing Z and are shown in the viewer's timezone by the zonedDate pipe. */
@Component({
  selector: 'app-credit-usage',
  templateUrl: './credit-usage.component.html',
  styleUrls: ['./credit-usage.component.scss'],
})
export class CreditUsageComponent implements OnInit {
  readonly columns = ['when', 'what', 'credits', 'paidBy'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  usage: PagedResult<TenantCreditUsage> = emptyPage<TenantCreditUsage>();
  loading = true;
  /** null: everything; true: only what the platform covered; false: only what came out of this workspace's balance. */
  covered: boolean | null = null;

  private page = 1;
  private pageSize = DEFAULT_PAGE_SIZE;

  constructor(private readonly billing: BillingService) {}

  ngOnInit(): void {
    this.load();
  }

  quotaLabel(type: QuotaType): string {
    return QUOTA_TYPE_LABELS[type];
  }

  onFilter(covered: boolean | null): void {
    this.covered = covered;
    this.page = 1;
    this.load();
  }

  onPage(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.load();
  }

  private load(): void {
    this.loading = true;
    this.billing
      .getCreditUsage({ page: this.page, pageSize: this.pageSize, coveredByPlatform: this.covered })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({ next: (page) => (this.usage = page) });
  }
}
