import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs/operators';

import { PlatformUserSearchResult } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformUserSearchService } from '../../../core/services/platform-user-search.service';
import {
  PlatformUserPasswordResetDialogComponent,
  ResetUserPasswordDialogData,
} from '../platform-user-password-reset-dialog/platform-user-password-reset-dialog.component';

@Component({
  selector: 'app-platform-user-search',
  templateUrl: './platform-user-search.component.html',
  styleUrls: ['./platform-user-search.component.scss'],
})
export class PlatformUserSearchComponent implements OnInit, OnDestroy {
  /** The Tenant column only earns its place in the cross-tenant search; a single organization's list is all one tenant. */
  get displayedColumns(): string[] {
    const columns = ['email', 'fullName', 'roles', 'isActive', 'lastLoginAt', 'actions'];
    if (!this.tenantId) columns.splice(2, 0, 'tenant');
    return columns;
  }
  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  results: PlatformUserSearchResult[] = [];
  loading = false;
  searched = false;

  /** Set when opened from the Tenants grid (?tenantId=...): lists that organization's users instead of searching. */
  tenantId: string | null = null;
  tenantName: string | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly userSearch: PlatformUserSearchService,
    private readonly route: ActivatedRoute,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  resetPassword(user: PlatformUserSearchResult): void {
    this.dialog
      .open<PlatformUserPasswordResetDialogComponent, ResetUserPasswordDialogData, boolean>(PlatformUserPasswordResetDialogComponent, {
        width: '460px',
        data: { userId: user.userId, email: user.email, fullName: user.fullName },
      })
      .afterClosed()
      .subscribe((done) => {
        if (done) this.notify.success(`Password reset for ${user.email}. They were signed out everywhere.`);
      });
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(
        switchMap((params) => {
          this.tenantId = params.get('tenantId');
          this.tenantName = params.get('tenantName');
          this.results = [];
          if (!this.tenantId) {
            this.loading = false;
            this.searched = false;
            this.searchControl.setValue('', { emitEvent: false });
            return of(null);
          }
          this.loading = true;
          this.searched = true;
          return this.userSearch.listForTenant(this.tenantId).pipe(
            catchError(() => of([] as PlatformUserSearchResult[])),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((results) => {
        if (results) this.results = results;
      });

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
