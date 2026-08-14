/** Roles seeded by the backend (Phase 1 §4.3). */
export enum AppRole {
  SuperAdmin = 'SuperAdmin',
  Admin = 'Admin',
  SalesManager = 'SalesManager',
  SalesAgent = 'SalesAgent',
}

/** Roles allowed to manage users and roles (Phase 2 §2). */
export const USER_ADMIN_ROLES: string[] = [AppRole.SuperAdmin, AppRole.Admin];

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
