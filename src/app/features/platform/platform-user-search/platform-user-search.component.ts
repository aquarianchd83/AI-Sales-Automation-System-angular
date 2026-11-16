import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, combineLatest, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, map, startWith, switchMap, takeUntil, tap } from 'rxjs/operators';

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

  /** Set when arriving from a tenant's user-count link: the list is scoped to that tenant. */
  tenantId: string | null = null;
  tenantName: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly userSearch: PlatformUserSearchService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const term$ = this.searchControl.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), startWith(''));
    const tenant$ = this.route.queryParamMap.pipe(
      map((params) => ({ id: params.get('tenantId'), name: params.get('tenantName') })),
      distinctUntilChanged((a, b) => a.id === b.id && a.name === b.name)
    );

    combineLatest([term$, tenant$])
      .pipe(
        tap(([term, tenant]) => {
          this.tenantId = tenant.id;
          this.tenantName = tenant.name;
          this.searched = !!term.trim() || !!tenant.id;
          this.loading = this.searched;
        }),
        switchMap(([term, tenant]) =>
          this.userSearch.search(term, tenant.id).pipe(
            catchError(() => of([] as PlatformUserSearchResult[])),
            tap(() => (this.loading = false))
          )
        ),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => (this.results = results));
  }

  clearTenantFilter(): void {
    this.router.navigate([], { queryParams: { tenantId: null, tenantName: null }, queryParamsHandling: 'merge' });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
