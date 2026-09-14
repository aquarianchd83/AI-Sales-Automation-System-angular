import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';

import { PlatformUserSearchResult } from '../../../core/models/platform.model';
import { PlatformUserSearchService } from '../../../core/services/platform-user-search.service';

@Component({
  selector: 'app-platform-user-search',
  templateUrl: './platform-user-search.component.html',
  styleUrls: ['./platform-user-search.component.scss'],
})
export class PlatformUserSearchComponent implements OnInit, OnDestroy {
  readonly displayedColumns = ['email', 'fullName', 'tenant', 'roles', 'isActive', 'lastLoginAt'];
  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  results: PlatformUserSearchResult[] = [];
  loading = false;
  searched = false;

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly userSearch: PlatformUserSearchService) {}

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap((term) => {
          this.searched = !!term.trim();
          this.loading = this.searched;
          return this.userSearch.search(term).pipe(
            catchError(() => of([])),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => (this.results = results));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
