import { FormControl } from '@angular/forms';

import { extractPlaceholderTokens, placeholderTokenValidator } from './placeholder-tokens';

describe('extractPlaceholderTokens', () => {
  it('extracts tokens in first-occurrence order, de-duplicated', () => {
    expect(extractPlaceholderTokens('Hi {{FirstName}}, this is for {{FirstName}} {{LastName}}')).toEqual([
      'FirstName',
      'LastName',
    ]);
  });

  it('returns an empty list when there are no tokens', () => {
    expect(extractPlaceholderTokens('Hello there.')).toEqual([]);
  });
});

describe('placeholderTokenValidator', () => {
  it('accepts the three known tokens', () => {
    const control = new FormControl('Hi {{FirstName}} {{LastName}}, we have your order for {{PhoneNumber}}.');
    expect(placeholderTokenValidator(control)).toBeNull();
  });

  it('accepts plain text with no placeholders at all', () => {
    expect(placeholderTokenValidator(new FormControl('Hello there.'))).toBeNull();
  });

  it('flags an unknown but well-formed token', () => {
    const control = new FormControl('Hi {{MiddleName}}');
    expect(placeholderTokenValidator(control)).toEqual({ unknownPlaceholder: 'MiddleName' });
  });

  it('does not treat a token containing a space as a placeholder at all', () => {
    // The token regex is \{\{(\w+)\}\} - no whitespace allowed inside the braces, matching
    // the backend's identical pattern. "{{Frist Name}}" therefore extracts zero tokens
    // (not one malformed one) and passes validation, but is also never substituted at send
    // time - it appears in the outgoing message exactly as typed.
    const control = new FormControl('Hi {{Frist Name}}');
    expect(placeholderTokenValidator(control)).toBeNull();
    expect(extractPlaceholderTokens('Hi {{Frist Name}}')).toEqual([]);
  });

  it('leaves emptiness to Validators.required', () => {
    expect(placeholderTokenValidator(new FormControl(''))).toBeNull();
  });
});
