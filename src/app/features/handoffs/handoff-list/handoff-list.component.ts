import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, finalize, startWith, switchMap, takeUntil } from 'rxjs/operators';

import { Handoff, HandoffStatus, canClaimHandoff, canResolveHandoff, handoffStatusChipClass } from '../../../core/models/handoff.model';
import { HandoffService } from '../../../core/services/handoff.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ResolveHandoffDialogComponent } from '../resolve-handoff-dialog/resolve-handoff-dialog.component';
import { User } from '../../../core/models/user.model';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-handoff-list',
  templateUrl: './handoff-list.component.html',
  styleUrls: ['./handoff-list.component.scss'],
})
export class HandoffListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['customer', 'triggerReason', 'status', 'assignedAgent', 'createdAt', 'actions'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusClass = handoffStatusChipClass;
  readonly canClaim = canClaimHandoff;
  readonly canResolve = canResolveHandoff;
  readonly statusFilters: { label: string; value: string | null }[] = [
    { label: 'Pending', value: HandoffStatus.Pending },
    { label: 'Assigned', value: HandoffStatus.Assigned },
    { label: 'In progress', value: HandoffStatus.InProgress },
    { label: 'Resolved', value: HandoffStatus.Resolved },
    { label: 'All', value: null },
  ];

  page: PagedResult<Handoff> = emptyPage<Handoff>();
  agents: User[] = [];
  loading = true;
  statusFilter: string | null = HandoffStatus.Pending;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly handoffs: HandoffService,
    private readonly users: UserService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.users.getPaged({ page: 1, pageSize: 100 }).subscribe((page) => (this.agents = page.items));

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.handoffs.getPaged(this.query, this.statusFilter ?? undefined).pipe(
            catchError(() => of(emptyPage<Handoff>(this.query.pageSize))),
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

  agentName(agentId: string | null): string {
    if (!agentId) {
      return '—';
    }
    return this.agents.find((a) => a.id === agentId)?.fullName ?? 'Unknown agent';
  }

  claim(handoff: Handoff, event: Event): void {
    event.stopPropagation();
    this.handoffs.claim(handoff.id).subscribe({
      next: () => {
        this.notify.success('Handoff claimed.');
        this.reload$.next();
      },
      error: () => {
        // ErrorInterceptor toasts it.
      },
    });
  }

  resolve(handoff: Handoff, event: Event): void {
    event.stopPropagation();
    this.dialog
      .open(ResolveHandoffDialogComponent, { data: { handoff }, width: '480px' })
      .afterClosed()
      .subscribe((resolved) => {
        if (resolved) {
          this.reload$.next();
        }
      });
  }
}
