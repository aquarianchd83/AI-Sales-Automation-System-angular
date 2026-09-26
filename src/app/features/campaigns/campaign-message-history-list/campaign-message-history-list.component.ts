import { ActivatedRoute } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { CampaignMessageHistoryEntry, campaignMessageStatusChipClass, formatStepTypeName } from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';

/** Every message a single campaign has sent — the per-send detail behind the audience roster's
 * status/step summary. Newest first. */
@Component({
  selector: 'app-campaign-message-history-list',
  templateUrl: './campaign-message-history-list.component.html',
  styleUrls: ['./campaign-message-history-list.component.scss'],
})
export class CampaignMessageHistoryListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['createdAt', 'customer', 'step', 'template', 'status'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusChipClass = campaignMessageStatusChipClass;
  readonly formatStepTypeName = formatStepTypeName;

  page: PagedResult<CampaignMessageHistoryEntry> = emptyPage<CampaignMessageHistoryEntry>();
  loading = true;
  failed = false;

  private campaignId = '';
  private pageIndex = 1;
  private pageSize = DEFAULT_PAGE_SIZE;
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly campaigns: CampaignService
  ) {}

  ngOnInit(): void {
    this.campaignId = this.route.snapshot.paramMap.get('id') ?? '';

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          this.failed = false;
          return this.campaigns.getHistory(this.campaignId, this.buildQuery()).pipe(
            catchError(() => {
              this.failed = true;
              return of(emptyPage<CampaignMessageHistoryEntry>(this.pageSize));
            }),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.pageIndex = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.reload$.next();
  }

  displayName(entry: CampaignMessageHistoryEntry): string {
    const name = [entry.firstName, entry.lastName].filter(Boolean).join(' ').trim();
    return name || entry.phoneNumberE164;
  }

  private buildQuery(): PagedQuery {
    return { page: this.pageIndex, pageSize: this.pageSize };
  }
}
