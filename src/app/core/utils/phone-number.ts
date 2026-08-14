import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Mirrors the backend's PhoneNumberNormalizer.
 *
 * The customer base is India, so a number with no country code is assumed Indian and gets
 * +91; a number carrying an explicit country code is respected as-is. Keeping this in step
 * with the server matters in both directions — a stricter rule here rejects numbers the API
 * would have accepted, and a looser one pushes the failure to a 400 after submit.
 *
 * Accepts, for an Indian number: 9820098200, 09820098200, 919820098200,
 * +91 98200-98200, 0091 9820098200 — all normalize to +919820098200. A fully qualified
 * non-Indian E.164 number (e.g. +15551234567) passes through unchanged.
 */
const SEPARATORS = /[\s\-.()]/g;
const INDIA_CALLING_CODE = '91';
/** Indian mobile numbers are 10 digits starting 6-9. Landlines are out of scope for WhatsApp. */
const INDIAN_SUBSCRIBER = /^[6-9]\d{9}$/;
const GENERIC_E164 = /^\+[1-9]\d{7,14}$/;
const DIGITS_ONLY = /^\d+$/;

/** Returns the E.164 form, or null when the input cannot be resolved to a number. */
export function normalizePhoneNumber(input: string | null | undefined): string | null {
  if (!input || !input.trim()) {
    return null;
  }

  let value = input.trim().replace(SEPARATORS, '');

  // 00 is the international dialling prefix used across India and most of the world.
  if (value.startsWith('00')) {
    value = '+' + value.slice(2);
  }

  if (value.startsWith('+')) {
    const digits = value.slice(1);
    if (!DIGITS_ONLY.test(digits)) {
      return null;
    }
    if (digits.startsWith(INDIA_CALLING_CODE)) {
      return toIndian(digits.slice(INDIA_CALLING_CODE.length));
    }
    return GENERIC_E164.test(value) ? value : null;
  }

  if (!DIGITS_ONLY.test(value)) {
    return null;
  }

  // No country code: interpret against the Indian numbering plan.
  let subscriber: string | null = null;
  if (value.length === 12 && value.startsWith(INDIA_CALLING_CODE)) {
    subscriber = value.slice(2); // country code typed without the +
  } else if (value.length === 11 && value.startsWith('0')) {
    subscriber = value.slice(1); // domestic trunk prefix, not part of the number
  } else if (value.length === 10) {
    subscriber = value;
  }

  return toIndian(subscriber);
}

function toIndian(subscriber: string | null): string | null {
  if (!subscriber || !INDIAN_SUBSCRIBER.test(subscriber)) {
    return null;
  }
  return `+${INDIA_CALLING_CODE}${subscriber}`;
}

/** Reactive-forms validator accepting anything the backend can normalize. */
export const phoneNumberValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const value = control.value as string | null;
  if (!value || !String(value).trim()) {
    return null; // emptiness is Validators.required's job
  }
  return normalizePhoneNumber(String(value)) ? null : { phoneNumber: true };
};
