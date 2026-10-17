import {
  AnswerMap,
  AnswerValue,
  QuestionCondition,
  QuestionDef,
  QuestionnaireDefinition,
  QuestionnaireIssue,
  SPECIAL_PROPERTY,
  SpecialKind,
} from '../models/content-studio.model';

/**
 * The questionnaire's rules in the browser, so a conditional question appears or disappears the moment its answer changes. A
 * mirror of the API's QuestionnaireEngine - which is the authority and checks everything again on save - kept to the same rules
 * and exercised by the same cases (see questionnaire-engine.spec.ts), so the screen can never promise something the server refuses.
 */

export const DEFAULT_SHORT_TEXT_LENGTH = 200;
export const DEFAULT_LONG_TEXT_LENGTH = 4000;

export const SECRET_MESSAGE = "This looks like a password, access key or card number. Please don't put secrets here - leave them out.";

const SPECIAL_KINDS: SpecialKind[] = ['unknown', 'need_help', 'not_applicable'];

const SECRET_PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
  /\bEAA[A-Za-z0-9]{40,}/,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/,
  /\b(password|passwd|pwd|passcode|secret|api[ _-]?key|access[ _-]?token|auth[ _-]?token|client[ _-]?secret)\b\s*(is|:|=)\s*\S{4,}/i,
];

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48;
    if (alternate) {
      n *= 2;
      if (n > 9) {
        n -= 9;
      }
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/**
 * Whether free text looks like it contains a credential: a private key, a well-known key or token shape, "password: ...", or a card
 * number (13-19 digits that pass the Luhn check, so phone numbers and PIN codes are left alone). The same test as the API's, which
 * refuses such an answer on save - this only lets the screen say so before the tenant presses Save.
 */
export function looksLikeSecret(text: string): boolean {
  if (!text || !text.trim()) {
    return false;
  }
  if (SECRET_PATTERNS.some((p) => p.test(text))) {
    return true;
  }
  const candidates = text.match(/(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g) ?? [];
  return candidates.some((c) => {
    const digits = c.replace(/\D/g, '');
    return digits.length >= 13 && digits.length <= 19 && passesLuhn(digits);
  });
}

/** Whether the answer is "I don't know" / "I need help" / "Not applicable" rather than an answer to the question itself. */
export function isSpecial(value: unknown): boolean {
  return specialKind(value) !== null;
}

export function specialKind(value: unknown): string | null {
  if (value && typeof value === 'object' && !Array.isArray(value) && SPECIAL_PROPERTY in (value as Record<string, unknown>)) {
    const kind = (value as Record<string, unknown>)[SPECIAL_PROPERTY];
    return typeof kind === 'string' ? kind : '';
  }
  return null;
}

export function special(kind: SpecialKind): AnswerValue {
  return { [SPECIAL_PROPERTY]: kind } as unknown as AnswerValue;
}

function specialProblem(question: QuestionDef, value: unknown): string | null {
  const kind = specialKind(value);
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length !== 1 || kind === null || !SPECIAL_KINDS.includes(kind as SpecialKind)) {
    return 'That is not a valid way to skip a question.';
  }
  return question.requireKnown ? 'This one needs a real answer - "I don\'t know" is not accepted here.' : null;
}

/** The steps of the wizard: the asked questions grouped by their group in order of first appearance; an ungrouped question is a step of its own. */
export function steps(definition: QuestionnaireDefinition, visible: ReadonlySet<string>): QuestionDef[][] {
  const result: QuestionDef[][] = [];
  const byGroup = new Map<string, QuestionDef[]>();

  for (const question of definition.questions.filter((q) => visible.has(q.key))) {
    const group = question.group?.trim();
    if (!group) {
      result.push([question]);
      continue;
    }

    const key = group.toLowerCase();
    let step = byGroup.get(key);
    if (!step) {
      step = [];
      byGroup.set(key, step);
      result.push(step);
    }
    step.push(question);
  }

  return result;
}

export function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(isAnswered);
  }
  return true; // a number or a boolean, false and 0 included
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function sameValue(answer: unknown, value: unknown): boolean {
  if (typeof answer === 'string' && typeof value === 'string') {
    return answer.trim().toLowerCase() === value.trim().toLowerCase();
  }
  const a = asNumber(answer);
  const b = asNumber(value);
  if (a !== null && b !== null) {
    return a === b;
  }
  if (typeof answer === 'boolean' && typeof value === 'boolean') {
    return answer === value;
  }
  return false;
}

function containsValue(answer: unknown, value: unknown): boolean {
  if (Array.isArray(answer)) {
    return answer.some((item) => sameValue(item, value));
  }
  if (typeof answer === 'string' && typeof value === 'string') {
    return answer.toLowerCase().includes(value.toLowerCase());
  }
  return false;
}

export function evaluate(condition: QuestionCondition, answers: AnswerMap): boolean {
  if (condition.all) {
    return condition.all.every((c) => evaluate(c, answers));
  }
  if (condition.any) {
    return condition.any.some((c) => evaluate(c, answers));
  }

  const key = condition.questionKey ?? '';
  const has = Object.prototype.hasOwnProperty.call(answers, key);
  const answer = has ? answers[key] : undefined;
  const value = condition.value;

  switch (condition.operator) {
    case 'Answered':
      return has;
    case 'NotAnswered':
      return !has;
    case 'Equal':
      return has && sameValue(answer, value);
    case 'NotEqual':
      return !has || !sameValue(answer, value);
    case 'In':
      return has && Array.isArray(value) && value.some((v) => sameValue(answer, v));
    case 'Contains':
      return has && containsValue(answer, value);
    case 'GreaterThan': {
      const a = asNumber(answer);
      const b = asNumber(value);
      return has && a !== null && b !== null && a > b;
    }
    case 'LessThan': {
      const a = asNumber(answer);
      const b = asNumber(value);
      return has && a !== null && b !== null && a < b;
    }
    default:
      return false;
  }
}

/** The keys of the questions that are asked. An answer to a hidden question counts as no answer, so hiding one can hide those after it. */
export function visibleKeys(definition: QuestionnaireDefinition, answers: AnswerMap): Set<string> {
  const visible = new Set<string>();
  const effective: AnswerMap = {};

  for (const question of definition.questions) {
    if (question.showWhen && !evaluate(question.showWhen, effective)) {
      continue;
    }
    visible.add(question.key);
    const answer = answers[question.key];
    // "I don't know" is an answer for progress but says nothing a later question can depend on.
    if (isAnswered(answer) && !isSpecial(answer)) {
      effective[question.key] = answer;
    }
  }

  return visible;
}

/** The answers that belong: to questions that exist, are asked, and are actually answered. */
export function prune(definition: QuestionnaireDefinition, answers: AnswerMap): AnswerMap {
  const visible = visibleKeys(definition, answers);
  const kept: AnswerMap = {};
  for (const [key, value] of Object.entries(answers)) {
    if (visible.has(key) && isAnswered(value)) {
      kept[key] = value;
    }
  }
  return kept;
}

function valueProblem(question: QuestionDef, value: AnswerValue): string | null {
  switch (question.type) {
    case 'ShortText':
    case 'LongText': {
      if (typeof value !== 'string') {
        return 'Answer with text.';
      }
      const max = question.maxLength ?? (question.type === 'ShortText' ? DEFAULT_SHORT_TEXT_LENGTH : DEFAULT_LONG_TEXT_LENGTH);
      if (value.length > max) {
        return `Keep this to ${max} characters or fewer.`;
      }
      return looksLikeSecret(value) ? SECRET_MESSAGE : null;
    }
    case 'Number': {
      const n = asNumber(value);
      if (n === null || typeof value === 'boolean') {
        return 'Answer with a number.';
      }
      if (question.min != null && n < question.min) {
        return `Must be at least ${question.min}.`;
      }
      if (question.max != null && n > question.max) {
        return `Must be at most ${question.max}.`;
      }
      return null;
    }
    case 'Boolean':
      return typeof value === 'boolean' ? null : 'Answer yes or no.';
    case 'SingleChoice':
      return typeof value === 'string' && (question.options ?? []).some((o) => o.value.toLowerCase() === value.toLowerCase())
        ? null
        : 'Choose one of the listed options.';
    case 'MultiChoice':
      return Array.isArray(value) && value.every((v) => (question.options ?? []).some((o) => o.value.toLowerCase() === String(v).toLowerCase()))
        ? null
        : 'Choose only from the listed options.';
    case 'Structured': {
      if (typeof value !== 'object' || Array.isArray(value)) {
        return 'Answer with the listed fields.';
      }
      for (const [fieldKey, fieldValue] of Object.entries(value as Record<string, unknown>)) {
        if (typeof fieldValue === 'string' && looksLikeSecret(fieldValue)) {
          return SECRET_MESSAGE;
        }
        if (typeof fieldValue === 'string' && fieldValue.length > DEFAULT_SHORT_TEXT_LENGTH && (question.fields ?? []).some((f) => f.key === fieldKey)) {
          return `Keep this to ${DEFAULT_SHORT_TEXT_LENGTH} characters or fewer.`;
        }
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * What stops the questionnaire being completed: every asked, required question has an answer, every required field of a
 * structured answer is filled, and every answer given is acceptable. A question that is not asked is never required.
 */
export function validateForComplete(definition: QuestionnaireDefinition, answers: AnswerMap): QuestionnaireIssue[] {
  const issues: QuestionnaireIssue[] = [];
  const visible = visibleKeys(definition, answers);

  for (const question of definition.questions.filter((q) => visible.has(q.key))) {
    const answer = answers[question.key];
    if (!isAnswered(answer)) {
      if (question.required) {
        issues.push({ key: question.key, message: 'This question needs an answer.' });
      }
      continue;
    }

    // A tenant who said they don't know has answered; the studio treats it as a gap to follow up, not a reason to hold them here.
    const problem = isSpecial(answer) ? specialProblem(question, answer) : valueProblem(question, answer);
    if (problem) {
      issues.push({ key: question.key, message: problem });
    }

    if (question.type === 'Structured' && !isSpecial(answer)) {
      const object = answer as Record<string, unknown>;
      for (const field of (question.fields ?? []).filter((f) => f.required)) {
        if (!isAnswered(object[field.key])) {
          issues.push({ key: `${question.key}.${field.key}`, message: `${field.label} needs an answer.` });
        }
      }
    }
  }

  return issues;
}
