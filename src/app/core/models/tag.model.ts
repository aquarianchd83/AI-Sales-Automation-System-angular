/**
 * TagDto. `customerCount` reflects only live customers — the backend's query excludes
 * soft-deleted rows via the global filter, so it matches what the customer list shows.
 */
export interface Tag {
  id: string;
  name: string;
  customerCount: number;
  createdAt: string;
}

export interface CreateTagRequest {
  name: string;
}

export interface UpdateTagRequest {
  name: string;
}

/** TagRuleBuilders.ValidTagName — mirrored here so the form fails the same names. */
export const TAG_NAME_MAX_LENGTH = 100;
/** Reserved as the import file's tag separators, so a tag name can never contain them. */
export const TAG_NAME_FORBIDDEN_CHARS = [',', ';'];
