import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';

import { LOG_LEVELS, LogEntry, LogQuery, logLevelChipClass } from '../../../core/models/log.model';
import { LogService } from '../../../core/services/log.service';
import { PAGE_SIZE_OPTIONS, PagedResult, emptyPage } from '../../../core/models/paged-result.model';

@Component({
  selector: 'app-log-list',
  templateUrl: './log-list.component.html',
  styleUrls: ['./log-list.component.scss'],
})
export class LogListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = ['timestamp', 'level', 'module', 'message'];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly levelClass = logLevelChipClass;
  readonly levels = LOG_LEVELS;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  readonly dateControl = new FormControl<string | null>(null);
  readonly levelControl = new FormControl<string | null>(null);
  readonly moduleControl = new FormControl<string | null>(null);

  page: PagedResult<LogEntry> = emptyPage<LogEntry>(50);
  loading = true;
  loadingDates = true;
  loadingModules = true;
  availableDates: string[] = [];
  /** Scoped to the selected date — a module that logged something yesterday may not have logged
   * anything today, so the list is refetched whenever the date filter changes. */
  availableModules: string[] = [];
  /** Row indices with their full (possibly multi-line) message expanded — keyed by index within
   * the current page, so it naturally resets whenever the page/filters change. */
  readonly expandedRows = new Set<number>();

  private query: LogQuery = { page: 1, pageSize: 50 };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(private readonly logs: LogService) {}

  ngOnInit(): void {
    this.logs
      .getAvailableDates()
      .pipe(
        catchError(() => of([])),
        finalize(() => (this.loadingDates = false)),
        takeUntil(this.destroy$)
      )
      .subscribe((dates) => {
        this.availableDates = dates;
        // Newest first per GetAvailableDates' contract — default to it rather than leaving the
        // filter unset, so the date picker always shows what's actually selected.
        const initialDate = dates[0] ?? null;
        this.dateControl.setValue(initialDate, { emitEvent: false });
        this.query = { ...this.query, date: initialDate ?? undefined };
        this.loadModules(initialDate);
        this.reload$.next();
      });

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.query = { ...this.query, page: 1, search: search || undefined };
        this.paginator?.firstPage();
        this.reload$.next();
      });

    this.moduleControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((module) => {
      this.query = { ...this.query, page: 1, module: module ?? undefined };
      this.paginator?.firstPage();
      this.reload$.next();
    });

    this.dateControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((date) => {
      // A module valid for the previous date may not exist for this one — drop the selection
      // rather than silently filter by something that's no longer offered in the dropdown.
      this.moduleControl.setValue(null, { emitEvent: false });
      this.query = { ...this.query, page: 1, date: date ?? undefined, module: undefined };
      this.paginator?.firstPage();
      this.loadModules(date);
      this.reload$.next();
    });

    this.levelControl.valueChanges.pipe(takeUntil(this.destroy$)).subscribe((level) => {
      this.query = { ...this.query, page: 1, level: level ?? undefined };
      this.paginator?.firstPage();
      this.reload$.next();
    });

    this.reload$
      .pipe(
        switchMap(() => {
          this.loading = true;
          return this.logs.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<LogEntry>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => {
        this.page = page;
        this.expandedRows.clear();
      });
  }

  private loadModules(date: string | null): void {
    this.loadingModules = true;
    this.logs
      .getAvailableModules(date ?? undefined)
      .pipe(
        catchError(() => of([])),
        finalize(() => (this.loadingModules = false)),
        takeUntil(this.destroy$)
      )
      .subscribe((modules) => (this.availableModules = modules));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  /** Just the class name for the table cell (e.g. "ConversationService" from the fully qualified
   * "WhatsAppSalesAutomation.Application.Conversations.ConversationService") — the full path is
   * still what the filter matches against and what the title attribute shows on hover. */
  moduleName(module: string | null): string {
    if (!module) {
      return '—';
    }
    const lastDot = module.lastIndexOf('.');
    return lastDot === -1 ? module : module.slice(lastDot + 1);
  }

  /** Only the first line shows by default — a full exception stack trace inline would make the
   * table unreadable. */
  firstLine(message: string): string {
    const newlineIndex = message.indexOf('\n');
    return newlineIndex === -1 ? message : message.slice(0, newlineIndex);
  }

  isMultiline(message: string): boolean {
    return message.includes('\n');
  }

  isExpanded(index: number): boolean {
    return this.expandedRows.has(index);
  }

  toggleExpanded(index: number): void {
    if (this.expandedRows.has(index)) {
      this.expandedRows.delete(index);
    } else {
      this.expandedRows.add(index);
    }
  }

  refresh(): void {
    this.reload$.next();
  }
}
