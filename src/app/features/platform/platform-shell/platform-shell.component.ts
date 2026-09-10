import { Component } from '@angular/core';

interface PlatformNavTab {
  label: string;
  route: string;
}

/**
 * Secondary nav for the Platform Admin Console's 8 screens — the main shell already carries one
 * top-level "Platform Admin" entry (PlatformSuperAdmin-only), this is what that entry lands on.
 * Tenant detail (`tenants/:id`) is deliberately not one of these tabs — it's reached from the
 * Tenants list, not navigated to directly.
 */
@Component({
  selector: 'app-platform-shell',
  templateUrl: './platform-shell.component.html',
  styleUrls: ['./platform-shell.component.scss'],
})
export class PlatformShellComponent {
  readonly tabs: PlatformNavTab[] = [
    { label: 'Dashboard', route: '/platform/dashboard' },
    { label: 'Tenants', route: '/platform/tenants' },
    { label: 'Billing', route: '/platform/billing' },
    { label: 'Usage & Quotas', route: '/platform/usage' },
    { label: 'WhatsApp Connections', route: '/platform/whatsapp-connections' },
    { label: 'Users', route: '/platform/users' },
    { label: 'Audit Log', route: '/platform/audit-log' },
    { label: 'Announcements', route: '/platform/announcements' },
  ];
}
