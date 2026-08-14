import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Mirrors Application.Common.TemplatePlaceholderResolver. Both campaign step message text
 * and message template body text are validated against this same set — a typo like
 * {{Frist Name}} is caught here, at save time, instead of surfacing as a broken send later.
 */
export const KNOWN_PLACEHOLDER_TOKENS = ['FirstName', 'LastName', 'PhoneNumber'];

const TOKEN_PATTERN = /\{\{(\w+)\}\}/g;

/** Distinct token names, in first-occurrence order — matches the resolver's own ordering. */
export function extractPlaceholderTokens(bodyText: string): string[] {
  const tokens: string[] = [];
  TOKEN_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_PATTERN.exec(bodyText))) {
    const token = match[1];
    if (!tokens.some((t) => t.toLowerCase() === token.toLowerCase())) {
      tokens.push(token);
    }
  }
  return tokens;
}

export const placeholderTokenValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const value = control.value as string | null;
  if (!value) {
    return null; // emptiness is Validators.required's job
  }
  const unknown = extractPlaceholderTokens(value).filter(
    (token) => !KNOWN_PLACEHOLDER_TOKENS.some((known) => known.toLowerCase() === token.toLowerCase())
  );
  return unknown.length ? { unknownPlaceholder: unknown.join(', ') } : null;
};
