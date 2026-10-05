import {
  SetupAnswer,
  SetupAnswers,
  SetupCondition,
  SetupConditionOperator,
  SetupField,
  SetupFieldIssue,
} from '../models/application-setup.model';

/**
 * The client's copy of the visibility and validation rules, so the wizard reacts as the Talent types.
 * The API runs the same rules (SetupEvaluator) and is the authority - on any disagreement its answer wins,
 * which is why a save always returns the server's own evaluation and the wizard shows that.
 */

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** The picks of a multi-select, or a single-item list for any other answer. */
export function answerTokens(answer: SetupAnswer | undefined): string[] {
  if (answer === null || answer === undefined) {
    return [];
  }
  if (Array.isArray(answer)) {
    return answer.map((a) => String(a).trim()).filter((a) => a.length > 0);
  }
  const text = String(answer).trim();
  return text.length ? [text] : [];
}

export function conditionMatches(op: SetupConditionOperator, answer: SetupAnswer | undefined, expected: string | null): boolean {
  const tokens = answerTokens(answer);
  const wanted = (expected ?? '').trim().toLowerCase();
  const lower = tokens.map((t) => t.toLowerCase());

  switch (op) {
    case 'Empty':
      return tokens.length === 0;
    case 'NotEmpty':
      return tokens.length > 0;
    case 'Equals':
      return lower.includes(wanted);
    case 'NotEquals':
      return !lower.includes(wanted);
    case 'Contains':
      return lower.includes(wanted) || (lower.length === 1 && wanted.length > 0 && lower[0].includes(wanted));
    case 'In': {
      const set = wanted.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
      return lower.some((t) => set.includes(t));
    }
    default:
      return false;
  }
}

/** Keys of the fields that apply given the answers. A hidden parent hides its children; unknown parent or a loop hides the field. */
export function visibleFieldKeys(fields: SetupField[], answers: SetupAnswers): Set<string> {
  const active = fields.filter((f) => f.isActive);
  const byKey = new Map(active.map((f) => [f.fieldKey.toLowerCase(), f]));
  const memo = new Map<string, boolean>();

  const isVisible = (field: SetupField, visiting: Set<string>): boolean => {
    const key = field.fieldKey.toLowerCase();
    const known = memo.get(key);
    if (known !== undefined) {
      return known;
    }

    let result: boolean;
    const condition: SetupCondition | null = field.condition;
    if (!condition) {
      result = true;
    } else {
      const parent = byKey.get(condition.fieldKey.toLowerCase());
      if (visiting.has(key) || !parent) {
        result = false;
      } else {
        visiting.add(key);
        result = isVisible(parent, visiting) && conditionMatches(condition.operator, answers[parent.fieldKey], condition.value);
      }
    }

    memo.set(key, result);
    return result;
  };

  return new Set(active.filter((f) => isVisible(f, new Set<string>())).map((f) => f.fieldKey));
}

export function isBlankAnswer(field: SetupField, answer: SetupAnswer | undefined): boolean {
  if (answer === null || answer === undefined) {
    return true;
  }
  if (field.fieldType === 'MultiSelect') {
    return answerTokens(answer).length === 0;
  }
  if (field.fieldType === 'Checkbox') {
    return answer === false || String(answer).toLowerCase() === 'false';
  }
  return String(answer).trim().length === 0;
}

export function requiredMessage(field: SetupField): string {
  switch (field.fieldType) {
    case 'Checkbox':
      return `Please confirm: ${field.label}.`;
    case 'MultiSelect':
      return `Select at least one option for ${field.label}.`;
    case 'Dropdown':
    case 'Radio':
      return `Choose an option for ${field.label}.`;
    case 'FileUpload':
      return `Upload a file for ${field.label}.`;
    default:
      return `${field.label} is required.`;
  }
}

/** Format / range problem with a NON-blank answer, or null. */
export function answerProblem(field: SetupField, answer: SetupAnswer | undefined): string | null {
  if (isBlankAnswer(field, answer)) {
    return null;
  }

  const rules = field.validation;
  const label = field.label;
  const text = String(Array.isArray(answer) ? '' : answer).trim();

  switch (field.fieldType) {
    case 'Text':
    case 'MultilineText': {
      const max = rules?.maxLength ?? (field.fieldType === 'Text' ? 255 : 4000);
      if (text.length > max) {
        return `${label} must be at most ${max} characters.`;
      }
      if (rules?.minLength != null && text.length < rules.minLength) {
        return `${label} must be at least ${rules.minLength} characters.`;
      }
      if (rules?.pattern) {
        try {
          if (!new RegExp(rules.pattern).test(text)) {
            return rules.patternMessage || `${label} is not in the expected format.`;
          }
        } catch {
          return null; // a broken admin pattern never locks a Talent out
        }
      }
      return null;
    }
    case 'Number':
      return !/^-?\d+$/.test(text) ? `${label} must be a whole number.` : rangeProblem(field, Number(text));
    case 'Decimal':
      return !isNumeric(text) ? `${label} must be a number.` : rangeProblem(field, Number(text));
    case 'Currency':
      if (!isNumeric(text)) {
        return `${label} must be an amount.`;
      }
      if (Number(text) < 0) {
        return `${label} cannot be negative.`;
      }
      return Number(text) > 1_000_000_000 ? `${label} is too large.` : rangeProblem(field, Number(text));
    case 'Date':
      return /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text)) ? null : `${label} must be a valid date.`;
    case 'Dropdown':
    case 'Radio':
      return optionProblem(field, [text]);
    case 'MultiSelect': {
      const picks = answerTokens(answer);
      const problem = optionProblem(field, picks);
      if (problem) {
        return problem;
      }
      if (rules?.min != null && picks.length < rules.min) {
        return `Select at least ${rules.min} options for ${label}.`;
      }
      if (rules?.max != null && picks.length > rules.max) {
        return `Select at most ${rules.max} options for ${label}.`;
      }
      return null;
    }
    case 'Checkbox':
      return typeof answer === 'boolean' || text === 'true' || text === 'false' ? null : `${label} must be ticked or not.`;
    case 'Url':
      return isHttpUrl(text) ? null : `${label} must be a valid web address starting with http:// or https://.`;
    case 'Email':
      return text.length <= 254 && EMAIL.test(text) ? null : `${label} must be a valid email address.`;
    case 'Phone': {
      const digits = (text.match(/\d/g) ?? []).length;
      const chars = /^[\d+\s().-]+$/.test(text);
      const plusOk = !text.includes('+') || text.lastIndexOf('+') === 0;
      return chars && plusOk && digits >= 7 && digits <= 15 ? null : `${label} must be a valid phone number.`;
    }
    default:
      return null;
  }
}

/** Everything the wizard can say about the answers without asking the server: what is missing and what is wrong. */
export function checkAnswers(
  fields: SetupField[],
  answers: SetupAnswers
): { missing: SetupFieldIssue[]; invalid: SetupFieldIssue[]; visible: Set<string> } {
  const visible = visibleFieldKeys(fields, answers);
  const missing: SetupFieldIssue[] = [];
  const invalid: SetupFieldIssue[] = [];

  for (const field of fields.filter((f) => visible.has(f.fieldKey))) {
    const answer = answers[field.fieldKey];
    if (isBlankAnswer(field, answer)) {
      if (field.isRequired) {
        missing.push({ fieldKey: field.fieldKey, message: requiredMessage(field) });
      }
      continue;
    }
    const problem = answerProblem(field, answer);
    if (problem) {
      invalid.push({ fieldKey: field.fieldKey, message: problem });
    }
  }

  return { missing, invalid, visible };
}

/** Human readable form of an answer, for the review and summary screens. */
export function displayAnswer(field: SetupField, answer: SetupAnswer | undefined, currencySymbol = ''): string {
  if (isBlankAnswer(field, answer) && field.fieldType !== 'Checkbox') {
    return '—';
  }
  const label = (value: string): string => field.options.find((o) => o.value.toLowerCase() === value.toLowerCase())?.label ?? value;

  switch (field.fieldType) {
    case 'MultiSelect':
      return answerTokens(answer).map(label).join(', ');
    case 'Dropdown':
    case 'Radio':
      return label(String(answer));
    case 'Checkbox':
      return answer === true || String(answer).toLowerCase() === 'true' ? 'Yes' : 'No';
    case 'Currency':
      return `${currencySymbol}${Number(answer).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    case 'Number':
    case 'Decimal':
      return Number(answer).toLocaleString(undefined, { maximumFractionDigits: 6 });
    case 'FileUpload':
      return 'File uploaded';
    default:
      return String(answer);
  }
}

function isNumeric(text: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(text);
}

function rangeProblem(field: SetupField, value: number): string | null {
  const rules = field.validation;
  if (rules?.min != null && value < rules.min) {
    return `${field.label} must be at least ${rules.min}.`;
  }
  if (rules?.max != null && value > rules.max) {
    return `${field.label} must be at most ${rules.max}.`;
  }
  return null;
}

function optionProblem(field: SetupField, picks: string[]): string | null {
  if (!field.options.length) {
    return null;
  }
  const known = field.options.map((o) => o.value.toLowerCase());
  return picks.every((p) => known.includes(p.toLowerCase())) ? null : `Choose from the listed options for ${field.label}.`;
}

function isHttpUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.host.length > 0 && text.length <= 2000;
  } catch {
    return false;
  }
}
