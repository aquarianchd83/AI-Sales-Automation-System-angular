import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs/operators';

import {
  BUSINESS_FACT_CHANGE_LABELS,
  BUSINESS_FACT_STATUS_LABELS,
  BusinessFact,
  BusinessFactOrigin,
  BusinessFactRevision,
  BusinessFactSource,
  BusinessFactStatus,
  BusinessFactSummary,
  KNOWLEDGE_CLASSIFICATION_HINTS,
  KNOWLEDGE_CLASSIFICATION_LABELS,
  KnowledgeClassification,
  SaveBusinessFactBody,
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
 * already verified - and, for each, where it came from, how the tenant knows it, when it stops being true, and everything that has
 * happened to it. The list is on the left and the chosen fact opens on the right, so nobody leaves the page to check or fix one.
 * Anyone who can use the studio may add and retire facts; only an Admin can verify, because verifying is the statement "this is
 * true". A fact that came from the questionnaire is changed by answering that question again, not by editing it here - but the
 * proof and the end date of any fact can be added here without undoing its verification.
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
  readonly originEnum = BusinessFactOrigin;
  readonly classEnum = KnowledgeClassification;
  readonly classHints = KNOWLEDGE_CLASSIFICATION_HINTS;
  readonly changeLabels = BUSINESS_FACT_CHANGE_LABELS;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly columns = ['statement', 'category', 'status', 'actions'];
  readonly maxStatement = 1000;
  readonly maxSubject = 120;
  readonly maxContext = 300;
  readonly maxEvidence = 500;

  readonly search = new FormControl('', { nonNullable: true });
  readonly category = new FormControl('', { nonNullable: true });
  readonly statement = new FormControl('', { nonNullable: true });
  readonly subject = new FormControl('', { nonNullable: true });
  readonly context = new FormControl('', { nonNullable: true });
  /** How the tenant knows it is true: a document, a record, a signed form. */
  readonly evidence = new FormControl('', { nonNullable: true });
  /** The last day the fact is true (yyyy-MM-dd), or empty for a fact that does not run out. */
  readonly validUntil = new FormControl('', { nonNullable: true });

  readonly canVerify = this.auth.hasAnyRole([AppRole.Admin]);

  facts: PagedResult<BusinessFact> = emptyPage<BusinessFact>();
  summary: BusinessFactSummary | null = null;
  selected: BusinessFact | null = null;
  panel: PanelMode = 'none';
  history: BusinessFactRevision[] = [];

  statusFilter: BusinessFactStatus | null = null;
  categoryFilter: string | null = null;
  classificationFilter: KnowledgeClassification | null = null;

  loading = true;
  saving = false;
  acting = false;
  historyLoading = false;

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

  /** A fact's wording can be edited here only while it is the tenant's own and still in use. */
  get editable(): boolean {
    return this.panel === 'new' || (!!this.selected && !this.fromQuestionnaire && this.selected.status !== BusinessFactStatus.Retired);
  }

  /** The proof and end date can be added to any fact still in use, wherever it came from. */
  get detailsEditable(): boolean {
    return this.panel === 'new' || (!!this.selected && this.selected.status !== BusinessFactStatus.Retired);
  }

  get dirty(): boolean {
    if (this.panel === 'new') {
      return this.statement.value.trim().length > 0 && this.category.value.trim().length > 0;
    }
    const fact = this.selected;
    if (!fact) {
      return false;
    }
    const detailsChanged = this.evidence.value.trim() !== (fact.evidence ?? '') || this.validUntil.value !== this.dateOf(fact.expiresAtUtc);
    if (this.fromQuestionnaire) {
      return detailsChanged;
    }
    return (
      detailsChanged ||
      this.statement.value !== fact.statement ||
      this.category.value !== fact.category ||
      this.subject.value.trim() !== (fact.subject ?? '') ||
      this.context.value.trim() !== (fact.context ?? '')
    );
  }

  get hasFilters(): boolean {
    return this.statusFilter !== null || this.categoryFilter !== null || this.classificationFilter !== null || !!this.search.value.trim();
  }

  /** The label on a fact's chip: its status, except where the fact is out of date or only a claim, which matters more. */
  chipLabel(fact: BusinessFact): string {
    switch (fact.classification) {
      case KnowledgeClassification.Expired:
        return 'Out of date';
      case KnowledgeClassification.UnverifiedClaim:
        return 'Unverified claim';
      default:
        return BUSINESS_FACT_STATUS_LABELS[fact.status];
    }
  }

  chipClass(fact: BusinessFact): string {
    switch (fact.classification) {
      case KnowledgeClassification.Expired:
        return 'status status--expired';
      case KnowledgeClassification.UnverifiedClaim:
        return 'status status--claim';
      default:
        return this.statusClass(fact.status);
    }
  }

  classificationLabel(fact: BusinessFact): string {
    return KNOWLEDGE_CLASSIFICATION_LABELS[fact.classification];
  }

  /** Whether an Admin can confirm this fact now: it needs checking, or it was confirmed once and has gone out of date. */
  needsConfirming(fact: BusinessFact): boolean {
    return fact.status === BusinessFactStatus.Draft || fact.classification === KnowledgeClassification.Expired;
  }

  /** Where the fact came from, in the tenant's words. */
  sourceText(fact: BusinessFact): string {
    if (fact.origin === BusinessFactOrigin.AiInferred) {
      return 'Suggested by an AI model. It is never used until an Admin confirms it.';
    }
    if (fact.origin === BusinessFactOrigin.SystemDerived) {
      return 'Worked out by the system from your other answers.';
    }
    switch (fact.sourceType) {
      case BusinessFactSource.Questionnaire:
        return 'From your answer in the questionnaire.';
      case BusinessFactSource.FollowUp:
        return 'Your answer to a follow-up question.';
      default:
        return 'Added by you.';
    }
  }

  setStatus(status: BusinessFactStatus | null): void {
    this.statusFilter = this.statusFilter === status ? null : status;
    this.reset();
  }

  setOutOfDate(): void {
    this.classificationFilter = this.classificationFilter === KnowledgeClassification.Expired ? null : KnowledgeClassification.Expired;
    this.reset();
  }

  setCategory(category: string | null): void {
    this.categoryFilter = category;
    this.reset();
  }

  clearFilters(): void {
    this.statusFilter = null;
    this.categoryFilter = null;
    this.classificationFilter = null;
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
    this.fill(fact);
    this.loadHistory(fact.id);
  }

  startNew(): void {
    this.selected = null;
    this.panel = 'new';
    this.history = [];
    this.fill(null);
  }

  close(): void {
    this.selected = null;
    this.panel = 'none';
    this.history = [];
  }

  save(): void {
    if (!this.detailsEditable || !this.dirty || this.saving) {
      return;
    }

    this.saving = true;

    if (this.panel === 'view' && this.fromQuestionnaire) {
      // Only the proof and the end date: they describe the claim, they do not change what it says.
      this.studio
        .updateFactDetails(this.selected!.id, { evidence: this.evidence.value.trim() || null, expiresAtUtc: this.isoOf(this.validUntil.value) })
        .pipe(finalize(() => (this.saving = false)))
        .subscribe((fact) => {
          this.notify.success('Saved. The fact stays verified.');
          this.afterChange(fact);
        });
      return;
    }

    const body = this.body();
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

    const again = fact.status === BusinessFactStatus.Verified;
    this.acting = true;
    (again ? this.studio.verifyFact(fact.id, true) : this.studio.verifyFact(fact.id))
      .pipe(finalize(() => (this.acting = false)))
      .subscribe((updated) => {
        this.notify.success(again ? 'Confirmed again.' : 'Marked as verified.');
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

  private body(): SaveBusinessFactBody {
    return {
      category: this.category.value.trim(),
      statement: this.statement.value.trim(),
      subject: this.subject.value.trim() || null,
      context: this.context.value.trim() || null,
      evidence: this.evidence.value.trim() || null,
      expiresAtUtc: this.isoOf(this.validUntil.value),
    };
  }

  private fill(fact: BusinessFact | null): void {
    this.category.setValue(fact?.category ?? '');
    this.statement.setValue(fact?.statement ?? '');
    this.subject.setValue(fact?.subject ?? '');
    this.context.setValue(fact?.context ?? '');
    this.evidence.setValue(fact?.evidence ?? '');
    this.validUntil.setValue(this.dateOf(fact?.expiresAtUtc ?? null));
  }

  /** yyyy-MM-dd of a stored moment, for the date input. */
  private dateOf(iso: string | null): string {
    return iso ? iso.slice(0, 10) : '';
  }

  /** The end of the chosen day, so "valid until 31 December" includes the 31st. */
  private isoOf(date: string): string | null {
    return date ? `${date}T23:59:59Z` : null;
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

  private loadHistory(id: string): void {
    this.historyLoading = true;
    this.studio
      .getFactHistory(id)
      .pipe(finalize(() => (this.historyLoading = false)))
      .subscribe({ next: (history) => (this.selected?.id === id ? (this.history = history) : undefined) });
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
        classification: this.classificationFilter,
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
