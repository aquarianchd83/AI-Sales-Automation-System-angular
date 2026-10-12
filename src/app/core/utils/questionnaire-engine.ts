import {
  AnswerMap,
  AnswerValue,
  QuestionCondition,
  QuestionDef,
  QuestionnaireDefinition,
  QuestionnaireIssue,
} from '../models/content-studio.model';

/**
 * The questionnaire's rules in the browser, so a conditional question appears or disappears the moment its answer changes. A
 * mirror of the API's QuestionnaireEngine - which is the authority and checks everything again on save - kept to the same rules
 * and exercised by the same cases (see questionnaire-engine.spec.ts), so the screen can never promise something the server refuses.
 */

export const DEFAULT_SHORT_TEXT_LENGTH = 200;
export const DEFAULT_LONG_TEXT_LENGTH = 4000;

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
    if (isAnswered(answer)) {
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
      return value.length > max ? `Keep this to ${max} characters or fewer.` : null;
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

    const problem = valueProblem(question, answer);
    if (problem) {
      issues.push({ key: question.key, message: problem });
    }

    if (question.type === 'Structured') {
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
