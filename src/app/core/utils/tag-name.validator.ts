import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { TAG_NAME_FORBIDDEN_CHARS } from '../models/tag.model';

/**
 * Mirrors TagRuleBuilders.ValidTagName: ',' and ';' are the import file's tag separators,
 * so a name containing one could never round-trip through an import.
 */
export const tagNameValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const value = control.value as string | null;
  if (!value) {
    return null; // emptiness is Validators.required's job
  }
  return TAG_NAME_FORBIDDEN_CHARS.some((char) => value.includes(char))
    ? { tagName: true }
    : null;
};
