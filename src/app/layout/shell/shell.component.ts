import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import { map, shareReplay } from 'rxjs/operators';

import { AuthService } from '../../core/services/auth.service';
import { AppRole, User } from '../../core/models/user.model';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: string[];
}

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
})
export class ShellComponent {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', route: '/dashboard', roles: [] },
    { label: 'Customers', icon: 'groups', route: '/customers', roles: [] },
    { label: 'Inbox', icon: 'inbox', route: '/conversations', roles: [] },
    { label: 'Handoffs', icon: 'support_agent', route: '/handoffs', roles: [] },
    { label: 'Leads', icon: 'insights', route: '/leads', roles: [] },
    { label: 'Knowledge Base', icon: 'menu_book', route: '/knowledge-base', roles: [] },
    { label: 'Tags', icon: 'sell', route: '/tags', roles: [] },
    { label: 'Campaigns', icon: 'campaign', route: '/campaigns', roles: [] },
    { label: 'Media Library', icon: 'perm_media', route: '/media', roles: [] },
    { label: 'Message Templates', icon: 'forum', route: '/message-templates', roles: [] },
    {
      label: 'Users & Roles',
      icon: 'admin_panel_settings',
      route: '/users',
      roles: [AppRole.SuperAdmin, AppRole.Admin],
    },
  ];

  readonly currentUser$: Observable<User | null> = this.auth.currentUser$;

  readonly isHandset$: Observable<boolean> = this.breakpoints
    .observe(Breakpoints.Handset)
    .pipe(
      map((result) => result.matches),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  constructor(
    private readonly auth: AuthService,
    private readonly breakpoints: BreakpointObserver
  ) {}

  initials(user: User | null): string {
    if (!user?.fullName) {
      return '?';
    }
    return user.fullName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  logout(): void {
    this.auth.logout();
  }
}
