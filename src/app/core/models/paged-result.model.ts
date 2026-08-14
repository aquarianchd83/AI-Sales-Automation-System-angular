/**
 * Mirrors the backend's PagedResult<T> (verified against /swagger/v1/swagger.json).
 * Note the field is `page`, not `pageNumber`.
 */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Query string for the paged list endpoints. The API binds PascalCase names
 * (`Page`, `PageSize`, `Search`) and supports nothing else — no sorting, no
 * per-field filters — so this interface stays deliberately small.
 */
export interface PagedQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function emptyPage<T>(pageSize = DEFAULT_PAGE_SIZE): PagedResult<T> {
  return { items: [], page: 1, pageSize, totalCount: 0, totalPages: 0 };
}

/** Maps a PagedQuery onto the PascalCase parameter names the API expects. */
export function toPagedParams(query: PagedQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.page != null) {
    params['Page'] = String(query.page);
  }
  if (query.pageSize != null) {
    params['PageSize'] = String(query.pageSize);
  }
  if (query.search) {
    params['Search'] = query.search;
  }
  return params;
}
