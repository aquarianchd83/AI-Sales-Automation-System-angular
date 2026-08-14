import { FormControl } from '@angular/forms';

import { tagNameValidator } from './tag-name.validator';

describe('tagNameValidator', () => {
  it('accepts an ordinary name', () => {
    expect(tagNameValidator(new FormControl('VIP'))).toBeNull();
  });

  it('rejects a comma — the import file field separator', () => {
    expect(tagNameValidator(new FormControl('VIP, Newsletter'))).toEqual({ tagName: true });
  });

  it('rejects a semicolon — the other import file separator', () => {
    expect(tagNameValidator(new FormControl('VIP; Newsletter'))).toEqual({ tagName: true });
  });

  it('leaves emptiness to Validators.required', () => {
    expect(tagNameValidator(new FormControl(''))).toBeNull();
  });
});
