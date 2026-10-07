/** One choice in a dropdown: what is stored, and what the user reads. */
export interface CustomerOption {
  value: string;
  label: string;
}

/**
 * Where a customer came from - the choices offered when adding or editing one. Stored as the words themselves, which is
 * what the customer list and the rest of the system already hold ("Website", "Referral", ...). "Import" and
 * "Lead discovery" are written by the system, not picked, so they are not offered - but a customer who already has one
 * keeps it (see {@link withCurrent}).
 */
export const CUSTOMER_SOURCES: CustomerOption[] = [
  'Website',
  'Referral',
  'Webinar',
  'Social media',
  'Advertisement',
  'Event',
  'Walk-in',
  'Phone call',
  'WhatsApp',
  'Other',
].map((value) => ({ value, label: value }));

/**
 * The language a customer prefers to be messaged in. Stored as the ISO 639-1 code (`en`, `hi`) - the form the AI
 * assistant records when it detects a language, and what message templates use.
 */
export const CUSTOMER_LANGUAGES: CustomerOption[] = [
  ['en', 'English'],
  ['hi', 'Hindi'],
  ['pa', 'Punjabi'],
  ['gu', 'Gujarati'],
  ['mr', 'Marathi'],
  ['bn', 'Bengali'],
  ['ta', 'Tamil'],
  ['te', 'Telugu'],
  ['kn', 'Kannada'],
  ['ml', 'Malayalam'],
  ['ur', 'Urdu'],
  ['ar', 'Arabic'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['pt', 'Portuguese'],
  ['nl', 'Dutch'],
  ['ja', 'Japanese'],
  ['zh', 'Chinese'],
].map(([value, label]) => ({ value, label }));

/**
 * The options plus the value the record already holds, when that is not one of them (an imported source, a language
 * code the list does not know). A dropdown that cannot show the current value would silently drop it on save. A value
 * that differs from an option only by case is the option ("website" is "Website").
 */
export function withCurrent(options: CustomerOption[], current: string | null | undefined): { options: CustomerOption[]; value: string } {
  const text = (current ?? '').trim();
  if (!text) {
    return { options, value: '' };
  }
  const match = options.find((o) => o.value.toLowerCase() === text.toLowerCase());
  if (match) {
    return { options, value: match.value };
  }
  return { options: [...options, { value: text, label: text }], value: text };
}
