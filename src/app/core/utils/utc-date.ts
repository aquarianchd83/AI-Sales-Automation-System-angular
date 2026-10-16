/**
 * Parses an API timestamp as UTC. The API serializes some UTC timestamps without a "Z" (SQL Server datetimes
 * read back carry no kind), and `new Date` would take those digits as the browser's local time and shift them
 * by the zone offset. A date-and-time string with no zone is therefore read as UTC; a date-only string and one
 * that already carries a zone are left as they are.
 */
export function parseUtc(value: string | Date): Date {
  if (value instanceof Date) {
    return value;
  }
  const hasTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value);
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
  return new Date(hasTime && !hasZone ? `${value}Z` : value);
}
