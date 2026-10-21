import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Subject, forkJoin, of } from 'rxjs';
import { catchError, finalize, map, switchMap, takeUntil } from 'rxjs/operators';

import { CampaignAudienceMember, CampaignStep, campaignCustomerStatusDescription } from '../../../core/models/campaign.model';
import {
  PipelineStage,
  buildPipelineStages,
  isFollowUpOverdue,
  isOpenStage,
} from '../../../core/models/campaign-pipeline.model';
import { CampaignService } from '../../../core/services/campaign.service';

/** The audience endpoint caps a page at 100 and has no per-status filter, so the board reads the roster in pages. */
const ROSTER_PAGE_SIZE = 100;
/** Past this many customers the board shows the most recently active ones and says so, instead of fetching without end. */
const MAX_ROSTER_PAGES = 5;
/** Cards shown per stage before "Show more". */
const CARDS_PER_STAGE = 5;

/**
 * The campaign's audience as a left-to-right pipeline: queued, each step sent, then how each customer ended up.
 * Read-only — a customer's stage is driven by sending and by their replies, not moved by hand.
 */
@Component({
  selector: 'app-campaign-pipeline',
  templateUrl: './campaign-pipeline.component.html',
  styleUrls: ['./campaign-pipeline.component.scss'],
})
export class CampaignPipelineComponent implements OnInit, OnChanges, OnDestroy {
  @Input() campaignId = '';
  @Input() steps: CampaignStep[] = [];
  /** Bump to refetch (the detail page does when progress reloads). */
  @Input() refreshToken = 0;
  /** A card was clicked — the detail page opens that customer's journey. */
  @Output() memberSelected = new EventEmitter<CampaignAudienceMember>();

  stages: PipelineStage[] = [];
  loading = true;
  failed = false;
  /** Roster rows in the campaign vs rows the board could load. */
  totalInCampaign = 0;
  loaded = 0;

  readonly cardsPerStage = CARDS_PER_STAGE;
  readonly statusDescription = campaignCustomerStatusDescription;
  private readonly expanded = new Set<string>();
  private readonly load$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();
  private members: CampaignAudienceMember[] = [];

  constructor(private readonly campaigns: CampaignService) {}

  ngOnInit(): void {
    this.load$
      .pipe(
        switchMap(() => {
          this.loading = true;
          this.failed = false;
          return this.loadRoster().pipe(
            catchError(() => {
              this.failed = true;
              return of({ members: [] as CampaignAudienceMember[], total: 0 });
            }),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(({ members, total }) => {
        this.members = members;
        this.totalInCampaign = total;
        this.loaded = members.length;
        this.rebuild();
      });
    this.load$.next();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['refreshToken'] && !changes['refreshToken'].firstChange) || (changes['campaignId'] && !changes['campaignId'].firstChange)) {
      this.load$.next();
    } else if (changes['steps'] && !changes['steps'].firstChange) {
      this.rebuild();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isEmpty(): boolean {
    return !this.loading && !this.failed && this.totalInCampaign === 0;
  }

  get truncated(): boolean {
    return this.totalInCampaign > this.loaded;
  }

  get openCount(): number {
    return this.stages.filter(isOpenStage).reduce((sum, s) => sum + s.members.length, 0);
  }

  /** Flex-grow share of the funnel bar; an empty stage keeps no width. */
  barShare(stage: PipelineStage): number {
    return stage.members.length;
  }

  visibleMembers(stage: PipelineStage): CampaignAudienceMember[] {
    return this.expanded.has(stage.key) ? stage.members : stage.members.slice(0, CARDS_PER_STAGE);
  }

  hiddenCount(stage: PipelineStage): number {
    return this.expanded.has(stage.key) ? 0 : Math.max(stage.members.length - CARDS_PER_STAGE, 0);
  }

  showMore(stage: PipelineStage): void {
    this.expanded.add(stage.key);
  }

  isOverdue(member: CampaignAudienceMember): boolean {
    return isFollowUpOverdue(member);
  }

  displayName(member: CampaignAudienceMember): string {
    const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
    return name || member.phoneNumberE164;
  }

  retry(): void {
    this.load$.next();
  }

  trackStage(_: number, stage: PipelineStage): string {
    return stage.key;
  }

  trackMember(_: number, member: CampaignAudienceMember): string {
    return member.customerId;
  }

  private rebuild(): void {
    this.stages = buildPipelineStages(this.steps, this.members);
  }

  /** First page, then whatever further pages exist (up to the cap) in parallel. */
  private loadRoster() {
    return this.campaigns.getAudience(this.campaignId, { page: 1, pageSize: ROSTER_PAGE_SIZE }).pipe(
      switchMap((first) => {
        const pages = Math.min(first.totalPages, MAX_ROSTER_PAGES);
        const rest = [];
        for (let page = 2; page <= pages; page++) {
          rest.push(this.campaigns.getAudience(this.campaignId, { page, pageSize: ROSTER_PAGE_SIZE }));
        }
        return rest.length
          ? forkJoin(rest).pipe(map((others) => ({ members: [...first.items, ...others.flatMap((p) => p.items)], total: first.totalCount })))
          : of({ members: first.items, total: first.totalCount });
      })
    );
  }
}
