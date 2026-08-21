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

import { Lead, LeadScoreBand, LeadStage, leadScoreChipClass, leadStageChipClass } from '../../../core/models/lead.model';
import { LeadService } from '../../../core/services/lead.service';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';

@Component({
  selector: 'app-lead-list',
  templateUrl: './lead-list.component.html',
  styleUrls: ['./lead-list.component.scss'],
})
export class LeadListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['customer', 'stage', 'score', 'attributes', 'lastActivityAt'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly stageClass = leadStageChipClass;
  readonly scoreClass = leadScoreChipClass;
  readonly stages = Object.values(LeadStage);
  readonly scores = Object.values(LeadScoreBand);

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly stageControl = new FormControl<string | null>(null);
  readonly scoreControl = new FormControl<string | null>(null);

  page: PagedResult<Lead> = emptyPage<Lead>();
  loading = true;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly leads: LeadService,
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

    this.stageControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.paginator?.firstPage();
      this.reload$.next();
    });

    this.scoreControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.query = { ...this.query, page: 1 };
      this.paginator?.firstPage();
      this.reload$.next();
    });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.leads.getPaged(this.query, this.stageControl.value ?? undefined, this.scoreControl.value ?? undefined).pipe(
            catchError(() => of(emptyPage<Lead>(this.query.pageSize))),
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

  attributesSummary(lead: Lead): string {
    return [lead.budget, lead.interest, lead.purchaseTimeline].filter(Boolean).join(' · ') || '—';
  }

  view(lead: Lead): void {
    void this.router.navigate([lead.id], { relativeTo: this.route });
  }
}
