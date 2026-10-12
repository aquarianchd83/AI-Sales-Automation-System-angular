import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';

import {
  BUSINESS_FACT_STATUS_LABELS,
  BusinessFact,
  BusinessFactSource,
  BusinessFactStatus,
  BusinessFactSummary,
} from '../../../core/models/content-studio.model';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { AppRole } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { ContentStudioService } from '../../../core/services/content-studio.service';
import { NotificationService } from '../../../core/services/notification.service';

/** The panel on the right: nothing open, a fact open, or a new one being written. */
type PanelMode = 'none' | 'view' | 'new';

/**
 * The business facts the studio may rely on: what the tenant says is true about its business, each one waiting to be checked or
 * already verified. The list is on the left and the chosen fact opens on the right, so nobody leaves the page to check or fix one.
 * Anyone who can use the studio may add and retire facts; only an Admin can verify, because verifying is the statement "this is
 * true". A fact that came from the questionnaire is changed by answering that question again, not by editing it here.
 */
@Component({
  selector: 'app-studio-facts',
  templateUrl: './studio-facts.component.html',
  styleUrls: ['./studio-facts.component.scss'],
})
export class StudioFactsComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly statusLabels = BUSINESS_FACT_STATUS_LABELS;
  readonly statusEnum = BusinessFactStatus;
  readonly sourceEnum = BusinessFactSource;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly columns = ['statement', 'category', 'status', 'actions'];
  readonly maxStatement = 1000;

  readonly search = new FormControl('', { nonNullable: true });
  readonly category = new FormControl('', { nonNullable: true });
  readonly statement = new FormControl('', { nonNullable: true });

  readonly canVerify = this.auth.hasAnyRole([AppRole.Admin]);

  facts: PagedResult<BusinessFact> = emptyPage<BusinessFact>();
  summary: BusinessFactSummary | null = null;
  selected: BusinessFact | null = null;
  panel: PanelMode = 'none';

  statusFilter: BusinessFactStatus | null = null;
  categoryFilter: string | null = null;

  loading = true;
  saving = false;
  acting = false;

  private page = 1;
  private pageSize = DEFAULT_PAGE_SIZE;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly studio: ContentStudioService,
    private readonly notify: NotificationService,
    private readonly auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadSummary();
    this.load();
    this.search.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$)).subscribe(() => this.reset());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get fromQuestionnaire(): boolean {
    return this.selected?.sourceType === BusinessFactSource.Questionnaire;
  }

  /** A fact can be edited here only while it is the tenant's own and still in use. */
  get editable(): boolean {
    return this.panel === 'new' || (!!this.selected && !this.fromQuestionnaire && this.selected.status !== BusinessFactStatus.Retired);
  }

  get dirty(): boolean {
    if (this.panel === 'new') {
      return this.statement.value.trim().length > 0 && this.category.value.trim().length > 0;
    }
    return !!this.selected && (this.statement.value !== this.selected.statement || this.category.value !== this.selected.category);
  }

  get hasFilters(): boolean {
    return this.statusFilter !== null || this.categoryFilter !== null || !!this.search.value.trim();
  }

  setStatus(status: BusinessFactStatus | null): void {
    this.statusFilter = this.statusFilter === status ? null : status;
    this.reset();
  }

  setCategory(category: string | null): void {
    this.categoryFilter = category;
    this.reset();
  }

  clearFilters(): void {
    this.statusFilter = null;
    this.categoryFilter = null;
    this.search.setValue('', { emitEvent: false });
    this.reset();
  }

  onPage(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.load();
  }

  open(fact: BusinessFact): void {
    this.selected = fact;
    this.panel = 'view';
    this.category.setValue(fact.category);
    this.statement.setValue(fact.statement);
  }

  startNew(): void {
    this.selected = null;
    this.panel = 'new';
    this.category.setValue('');
    this.statement.setValue('');
  }

  close(): void {
    this.selected = null;
    this.panel = 'none';
  }

  save(): void {
    if (!this.editable || !this.dirty || this.saving) {
      return;
    }

    const body = { category: this.category.value.trim(), statement: this.statement.value.trim() };
    this.saving = true;

    const request = this.panel === 'new' ? this.studio.createFact(body) : this.studio.updateFact(this.selected!.id, body);
    request.pipe(finalize(() => (this.saving = false))).subscribe((fact) => {
      this.notify.success(this.panel === 'new' ? 'Fact added. It needs checking before the studio can use it.' : 'Fact saved.');
      this.afterChange(fact);
    });
  }

  verify(fact: BusinessFact, event?: Event): void {
    event?.stopPropagation();
    if (!this.canVerify || this.acting) {
      return;
    }

    this.acting = true;
    this.studio
      .verifyFact(fact.id)
      .pipe(finalize(() => (this.acting = false)))
      .subscribe((updated) => {
        this.notify.success('Marked as verified.');
        this.afterChange(updated);
      });
  }

  retire(fact: BusinessFact): void {
    if (this.acting) {
      return;
    }

    this.acting = true;
    this.studio
      .retireFact(fact.id)
      .pipe(finalize(() => (this.acting = false)))
      .subscribe((updated) => {
        this.notify.success('Fact retired. The studio will no longer use it.');
        this.afterChange(updated);
      });
  }

  statusClass(status: BusinessFactStatus): string {
    return `status status--${BusinessFactStatus[status].toLowerCase()}`;
  }

  statusLabel(status: BusinessFactStatus): string {
    return BUSINESS_FACT_STATUS_LABELS[status];
  }

  private afterChange(fact: BusinessFact): void {
    this.open(fact);
    this.loadSummary();
    this.load();
  }

  private reset(): void {
    this.page = 1;
    this.paginator?.firstPage();
    this.load();
  }

  private loadSummary(): void {
    this.studio.getFactSummary().subscribe({ next: (summary) => (this.summary = summary) });
  }

  private load(): void {
    this.loading = true;
    this.studio
      .getFacts({
        page: this.page,
        pageSize: this.pageSize,
        search: this.search.value.trim() || undefined,
        status: this.statusFilter,
        category: this.categoryFilter,
      })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (page) => {
          this.facts = page;
          if (this.selected) {
            this.selected = page.items.find((f) => f.id === this.selected?.id) ?? this.selected;
          }
        },
      });
  }
}
