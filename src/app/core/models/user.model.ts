/**
 * Roles seeded by the backend - mirrors AppRoles.cs exactly.
 *
 * There is deliberately no SuperAdmin. It was a pre-multi-tenancy leftover that the backend split
 * into PlatformSuperAdmin (operates the SaaS) and Admin (runs one tenant); this enum went on
 * declaring it regardless. Nothing validates a role name, so gating on one no user can hold renders
 * for nobody - which is what silently happened to Campaigns' "Run jobs now" and the flow-docs
 * button. Add a member here only when AppRoles.cs has it too.
 */
export enum AppRole {
  Admin = 'Admin',
  SalesManager = 'SalesManager',
  SalesAgent = 'SalesAgent',
  /**
   * The SaaS platform operator role (SaaS conversion Phase A) — runs the platform itself, not any
   * one tenant's account. Excluded from USER_ADMIN_ROLES and every other tenant-scoped role list on
   * purpose: a PlatformSuperAdmin has no single tenant, so none of this panel's ordinary tenant
   * screens (built for one tenant's own admin/agents to manage their own data) have anything for
   * that role to do. Platform-wide operations instead live behind their own explicit, audited
   * screens — see PLATFORM_ADMIN_ROLES / the `platform` feature module (Platform Admin Console).
   */
  PlatformSuperAdmin = 'PlatformSuperAdmin',
}

/** Every tenant-scoped role — i.e. everyone except PlatformSuperAdmin. Gates the base tenant
 * screens (Dashboard, Customers, Inbox, ...) that used to have no role restriction at all: without
 * this, a PlatformSuperAdmin (who belongs to no tenant) could still reach them by typing the URL
 * directly, even though the shell nav never links to them for that role — see ShellComponent's own
 * split between tenantNavSections and the Platform Admin entry.  */
export const TENANT_ROLES: string[] = [
  AppRole.Admin,
  AppRole.SalesManager,
  AppRole.SalesAgent,
];

/** Roles allowed to manage users and roles (Phase 2 §2). */
export const USER_ADMIN_ROLES: string[] = [AppRole.Admin];

/** Roles allowed to manage a tenant's own WhatsApp/AI credentials and billing (SaaS conversion
 * Phases B/D) — the tenant's own admins, same set as USER_ADMIN_ROLES. Kept as its own constant
 * rather than reusing USER_ADMIN_ROLES directly so the two can diverge later without a misleading
 * shared name. */
export const TENANT_ADMIN_ROLES: string[] = [AppRole.Admin];

/** Roles allowed to read the tenant reports and nothing more: managers reading how campaigns and
 * agents are doing is the point of a report, so this is wider than TENANT_ADMIN_ROLES. */
export const REPORT_ROLES: string[] = [AppRole.Admin, AppRole.SalesManager];

/** GET /roles returns a plain array of role names, not objects. */
export type Role = string;

/** UserDto. */
export interface User {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  lastLoginAt: string | null;
}

/** CreateUserRequest — note there is no `isActive`; new users are created active. */
export interface CreateUserRequest {
  fullName: string;
  email: string;
  phoneNumber?: string | null;
  password: string;
  roles: string[];
}

/** UpdateUserRequest — email is immutable through this endpoint. */
export interface UpdateUserRequest {
  fullName: string;
  phoneNumber?: string | null;
  isActive: boolean;
}

export interface AssignRolesRequest {
  roles: string[];
}
