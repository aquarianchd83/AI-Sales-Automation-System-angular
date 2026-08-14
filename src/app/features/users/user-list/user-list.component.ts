import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
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

import { AuthService } from '../../../core/services/auth.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import { NotificationService } from '../../../core/services/notification.service';
import { Role, User } from '../../../core/models/user.model';
import { UserFormDialogComponent, UserFormDialogData } from '../user-form-dialog/user-form-dialog.component';
import { UserRolesDialogComponent } from '../user-roles-dialog/user-roles-dialog.component';
import { UserService } from '../../../core/services/user.service';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.scss'],
})
export class UserListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = [
    'fullName',
    'email',
    'roles',
    'isActive',
    'lastLoginAt',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<User> = emptyPage<User>();
  roles: Role[] = [];
  loading = true;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly users: UserService,
    private readonly auth: AuthService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.users.getRoles().subscribe({
      next: (roles) => (this.roles = roles),
      error: () => (this.roles = []),
    });

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
          return this.users.getPaged(this.query).pipe(
            // Caught inside the projection so one failed request does not complete
            // the outer stream and freeze paging/search for good.
            catchError(() => of(emptyPage<User>(this.query.pageSize))),
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
    this.query = {
      ...this.query,
      page: event.pageIndex + 1,
      pageSize: event.pageSize,
    };
    this.reload$.next();
  }

  /** Guards the UI against a user locking themselves out mid-session. */
  isSelf(user: User): boolean {
    return this.auth.currentUser?.id === user.id;
  }

  create(): void {
    this.openForm({ mode: 'create', roles: this.roles });
  }

  edit(user: User): void {
    this.openForm({ mode: 'edit', user, roles: this.roles });
  }

  manageRoles(user: User): void {
    this.dialog
      .open(UserRolesDialogComponent, {
        data: { user, roles: this.roles },
        width: '440px',
      })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload$.next();
        }
      });
  }

  delete(user: User): void {
    const data: ConfirmDialogData = {
      title: 'Delete this user?',
      message: `${user.fullName} will lose access immediately. Consider deactivating instead if you need to keep their history intact.`,
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.users.delete(user.id).subscribe(() => {
          this.notify.success('User deleted.');
          this.reload$.next();
        });
      });
  }

  private openForm(data: UserFormDialogData): void {
    this.dialog
      .open(UserFormDialogComponent, { data, width: '560px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload$.next();
        }
      });
  }
}
