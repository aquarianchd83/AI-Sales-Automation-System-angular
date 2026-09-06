import { ActivatedRoute, Router } from '@angular/router';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import { Conversation, ConversationStatus, conversationStatusChipClass } from '../../../core/models/conversation.model';
import { leadScoreChipClass } from '../../../core/models/lead.model';
import { ConversationHubService } from '../../../core/services/conversation-hub.service';
import { ConversationService } from '../../../core/services/conversation.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';

@Component({
  selector: 'app-conversation-list',
  templateUrl: './conversation-list.component.html',
  styleUrls: ['./conversation-list.component.scss'],
})
export class ConversationListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['customer', 'status', 'mode', 'leadScore', 'lastMessageAt', 'lastInboundMessageAt'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusClass = conversationStatusChipClass;
  readonly scoreClass = leadScoreChipClass;
  /** null = All. Every non-terminal-by-default view an agent actually works from. */
  readonly statusFilters: { label: string; value: string | null }[] = [
    { label: 'Open', value: ConversationStatus.Open },
    { label: 'Escalated', value: ConversationStatus.Escalated },
    { label: 'Closed', value: ConversationStatus.Closed },
    { label: 'All', value: null },
  ];

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<Conversation> = emptyPage<Conversation>();
  loading = true;
  statusFilter: string | null = ConversationStatus.Open;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly conversations: ConversationService,
    private readonly conversationHub: ConversationHubService,
    private readonly router: Router,
    private readonly route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.query = { ...this.query, page: 1, search: search || undefined };
        this.paginator?.firstPage();
        this.reload$.next();
      });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.conversations.getPaged(this.query, this.statusFilter ?? undefined).pipe(
            catchError(() => of(emptyPage<Conversation>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));

    // Live update: refreshes the currently-viewed page/filter in place (never jumps the user
    // back to page 1) whenever any conversation gets a new inbound message. Debounced so a burst
    // of messages across several conversations triggers one refetch, not one per message.
    this.conversationHub.newInboundMessage$
      .pipe(debounceTime(300), takeUntil(this.destroy$))
      .subscribe(() => this.reload$.next());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  setStatusFilter(value: string | null): void {
    if (this.statusFilter === value) {
      return;
    }
    this.statusFilter = value;
    this.query = { ...this.query, page: 1 };
    this.paginator?.firstPage();
    this.reload$.next();
  }

  view(conversation: Conversation): void {
    void this.router.navigate([conversation.id], { relativeTo: this.route });
  }
}
