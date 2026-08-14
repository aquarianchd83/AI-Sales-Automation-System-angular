import { Component, OnInit } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { CustomerService } from '../../core/services/customer.service';
import { USER_ADMIN_ROLES, User } from '../../core/models/user.model';
import { UserService } from '../../core/services/user.service';

interface Stat {
  label: string;
  icon: string;
  value: number | null;
  route: string;
}

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  readonly currentUser$: Observable<User | null> = this.auth.currentUser$;
  readonly canSeeUsers = this.auth.hasAnyRole(USER_ADMIN_ROLES);

  /**
   * Totals only. Breaking these down by opt-in status would need a filter parameter
   * the list endpoints do not accept — every tile would show the same number — so
   * the breakdown waits for the API to support it.
   */
  stats: Stat[] = [
    { label: 'Total customers', icon: 'groups', value: null, route: '/customers' },
  ];

  loading = true;

  constructor(
    private readonly auth: AuthService,
    private readonly customers: CustomerService,
    private readonly users: UserService
  ) {}

  ngOnInit(): void {
    if (this.canSeeUsers) {
      this.stats.push({
        label: 'Panel users',
        icon: 'admin_panel_settings',
        value: null,
        route: '/users',
      });
    }

    const queries: Observable<number | null>[] = [
      this.count(this.customers.getPaged({ page: 1, pageSize: 1 })),
    ];
    if (this.canSeeUsers) {
      queries.push(this.count(this.users.getPaged({ page: 1, pageSize: 1 })));
    }

    let outstanding = queries.length;
    queries.forEach((query, index) =>
      query.subscribe((value) => {
        this.stats[index].value = value;
        // Counts down on failure too (count() maps errors to null), so a dead API
        // clears the spinner instead of leaving it spinning forever.
        if (--outstanding === 0) {
          this.loading = false;
        }
      })
    );
  }

  /** Asks for a single row and reads totalCount from the paged envelope. */
  private count(source: Observable<{ totalCount: number }>): Observable<number | null> {
    return source.pipe(
      map((page) => page.totalCount),
      catchError(() => of(null))
    );
  }
}
