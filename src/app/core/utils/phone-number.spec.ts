import { FormControl } from '@angular/forms';

import { normalizePhoneNumber, phoneNumberValidator } from './phone-number';

/**
 * These cases mirror the backend's PhoneNumberNormalizer. If the server's rules change,
 * these should fail — that is the point of duplicating them here.
 */
describe('normalizePhoneNumber', () => {
  it('applies +91 to a bare Indian mobile number', () => {
    expect(normalizePhoneNumber('9820098200')).toBe('+919820098200');
  });

  it('strips the domestic trunk prefix', () => {
    expect(normalizePhoneNumber('09820098200')).toBe('+919820098200');
  });

  it('accepts the country code typed without a plus', () => {
    expect(normalizePhoneNumber('919820098200')).toBe('+919820098200');
  });

  it('accepts the 00 international dialling prefix', () => {
    expect(normalizePhoneNumber('0091 9820098200')).toBe('+919820098200');
  });

  it('ignores separators a human might type', () => {
    expect(normalizePhoneNumber('+91 98200-98200')).toBe('+919820098200');
    expect(normalizePhoneNumber('(98200) 98200')).toBe('+919820098200');
    expect(normalizePhoneNumber(' 98200.98200 ')).toBe('+919820098200');
  });

  it('passes a fully qualified non-Indian number through unchanged', () => {
    expect(normalizePhoneNumber('+15551234567')).toBe('+15551234567');
    expect(normalizePhoneNumber('+442079460958')).toBe('+442079460958');
  });

  it('rejects Indian numbers outside the 6-9 mobile range', () => {
    expect(normalizePhoneNumber('5820098200')).toBeNull();
    expect(normalizePhoneNumber('+915820098200')).toBeNull();
  });

  it('rejects numbers of the wrong length', () => {
    expect(normalizePhoneNumber('982009820')).toBeNull(); // 9 digits
    expect(normalizePhoneNumber('98200982001')).toBeNull(); // 11, no trunk prefix
    expect(normalizePhoneNumber('+123')).toBeNull();
  });

  it('rejects anything that is not digits', () => {
    expect(normalizePhoneNumber('98200ABCDE')).toBeNull();
    expect(normalizePhoneNumber('+91982009820x')).toBeNull();
  });

  it('treats blank input as unresolvable', () => {
    expect(normalizePhoneNumber('')).toBeNull();
    expect(normalizePhoneNumber('   ')).toBeNull();
    expect(normalizePhoneNumber(null)).toBeNull();
  });
});

describe('phoneNumberValidator', () => {
  it('accepts anything the normalizer can resolve', () => {
    expect(phoneNumberValidator(new FormControl('9820098200'))).toBeNull();
    expect(phoneNumberValidator(new FormControl('+15551234567'))).toBeNull();
  });

  it('flags input the backend would reject', () => {
    expect(phoneNumberValidator(new FormControl('12345'))).toEqual({ phoneNumber: true });
  });

  it('leaves emptiness to Validators.required', () => {
    expect(phoneNumberValidator(new FormControl(''))).toBeNull();
  });
});
