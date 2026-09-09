import { AppRole } from './user.model';

/** Roles allowed to view and change system configuration. Super admin only. */
export const SETTINGS_ADMIN_ROLES: string[] = [AppRole.SuperAdmin];

/**
 * SettingItemDto. Secrets never round-trip in plain text: when `isSecret` is true,
 * `value` is null and `hasValue`/`valueHint` are the only signal of what's stored.
 * Leaving the field blank on save keeps the existing secret; typing a value replaces it.
 */
export interface SettingItem {
  key: string;
  category: string;
  isSecret: boolean;
  isList: boolean;
  description: string | null;
  value: string | null;
  hasValue: boolean;
  valueHint: string | null;
}

/** SettingCategoryDto. */
export interface SettingCategory {
  category: string;
  items: SettingItem[];
}

/** UpdateSettingsRequest — only the keys being changed need to be present. */
export interface UpdateSettingsRequest {
  values: Record<string, string | null>;
}
