import { PLATFORM_ADMIN_ROLES } from './platform.model';

/**
 * Roles allowed to view and change system configuration - PlatformSuperAdmin only. Used to be tenant
 * SuperAdmin (pre-SaaS-conversion); the backend's own SettingsController moved to PlatformSuperAdmin
 * when the Platform Admin Console landed (every category here - WhatsApp/AiProviders/Campaigns/
 * Media/Messaging/Ai/MediaStorage - is platform-global config, not any one tenant's), and this
 * constant is kept in sync with that rather than duplicated, so the two can't drift again.
 */
export const SETTINGS_ADMIN_ROLES: string[] = PLATFORM_ADMIN_ROLES;

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
