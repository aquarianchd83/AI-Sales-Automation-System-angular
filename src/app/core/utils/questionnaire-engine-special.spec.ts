import { AnswerMap, AnswerValue, QuestionnaireDefinition, SpecialKind } from '../models/content-studio.model';
import {
  SECRET_MESSAGE,
  isAnswered,
  isSpecial,
  looksLikeSecret,
  prune,
  special,
  specialKind,
  steps,
  validateForComplete,
  visibleKeys,
} from './questionnaire-engine';

// The same cases as the API's QuestionnaireSpecialAnswerTests: "I don't know", the refusal of secrets, and the wizard's groups.
const DEFINITION: QuestionnaireDefinition = {
  questions: [
    { key: 'name', type: 'ShortText', prompt: 'Name?', required: true, requireKnown: true, group: 'About' },
    { key: 'price', type: 'ShortText', prompt: 'Price?', required: true, group: 'Money' },
    { key: 'has_branch', type: 'Boolean', prompt: 'Branch?', group: 'Money' },
    { key: 'branch_city', type: 'ShortText', prompt: 'Which city?', required: true, group: 'Money', showWhen: { questionKey: 'has_branch', operator: 'Equal', value: true } },
    { key: 'hours', type: 'Structured', prompt: 'Hours?', required: true, fields: [{ key: 'weekdays', label: 'Mon-Fri', type: 'ShortText', required: true }] },
    { key: 'after_branch', type: 'ShortText', prompt: 'Anything else?', showWhen: { questionKey: 'has_branch', operator: 'Answered' } },
  ],
};

const unknown = (): AnswerValue => special('unknown');

describe('questionnaire engine: special answers', () => {
  it('recognises a special answer and its kind', () => {
    expect(isSpecial(unknown())).toBeTrue();
    expect(specialKind(special('need_help'))).toBe('need_help');
    expect(isSpecial('unknown')).toBeFalse();
    expect(isSpecial({ weekdays: '9-5' })).toBeFalse();
    expect(isSpecial(['a'])).toBeFalse();
  });

  it('counts a special answer as answered, so it never blocks completing', () => {
    expect(isAnswered(unknown())).toBeTrue();

    const issues = validateForComplete(DEFINITION, { name: 'Sunrise', price: unknown(), hours: unknown() });

    expect(issues).toEqual([]);
  });

  it('still requires a mandatory question that was left blank', () => {
    const keys = validateForComplete(DEFINITION, { name: 'Sunrise' }).map((i) => i.key);

    expect(keys).toContain('price');
    expect(keys).toContain('hours');
  });

  it('refuses a special answer on a question that needs a real answer', () => {
    const issues = validateForComplete(DEFINITION, { name: unknown(), price: 'Rs 500', hours: { weekdays: '9-5' } });

    expect(issues.find((i) => i.key === 'name')?.message).toContain('real answer');
  });

  it('refuses a malformed special answer', () => {
    for (const bad of [{ $special: 'maybe' }, { $special: 3 }, { $special: 'unknown', extra: 'x' }]) {
      const issues = validateForComplete(DEFINITION, { name: 'Sunrise', price: bad as unknown as AnswerValue, hours: { weekdays: '9-5' } });
      expect(issues.some((i) => i.key === 'price')).withContext(JSON.stringify(bad)).toBeTrue();
    }
  });

  it('accepts each of the three kinds', () => {
    for (const kind of ['unknown', 'need_help', 'not_applicable'] as SpecialKind[]) {
      expect(validateForComplete(DEFINITION, { name: 'Sunrise', price: special(kind), hours: { weekdays: '9-5' } })).toEqual([]);
    }
  });

  it("does not demand a structured answer's required fields when the whole question was skipped", () => {
    expect(validateForComplete(DEFINITION, { name: 'Sunrise', price: 'Rs 500', hours: special('not_applicable') })).toEqual([]);
  });

  it('gives a later question nothing to depend on when the earlier one was skipped', () => {
    const skipped = visibleKeys(DEFINITION, { has_branch: unknown() });
    expect(skipped.has('branch_city')).toBeFalse();
    expect(skipped.has('after_branch')).toBeFalse();

    expect(visibleKeys(DEFINITION, { has_branch: false }).has('after_branch')).toBeTrue();
  });

  it('drops the special answer of a question that is no longer asked, like any other answer', () => {
    const kept: AnswerMap = prune(DEFINITION, { has_branch: false, branch_city: unknown() });

    expect(kept['has_branch']).toBe(false);
    expect(kept['branch_city']).toBeUndefined();
  });
});

describe('questionnaire engine: secrets', () => {
  it('recognises text that looks like a credential', () => {
    for (const text of [
      'password: hunter2hunter2',
      'my api key is sk-abcdefghijklmnopqrstuvwx',
      'AKIAABCDEFGHIJKLMNOP',
      'token = ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
      '-----BEGIN RSA PRIVATE KEY-----',
      'card 4111 1111 1111 1111 expiry 12/29',
      '4111-1111-1111-1111',
    ]) {
      expect(looksLikeSecret(text)).withContext(text).toBeTrue();
    }
  });

  it('leaves ordinary business text alone', () => {
    for (const text of [
      'Call us on 98765 43210',
      'We are at 12 MG Road, Pune - 411001',
      'Cataract surgery costs Rs 25,000 per eye',
      'Our PIN code is 411001 and the secret to our success is care',
      'Order number 1234567890123',
      '',
    ]) {
      expect(looksLikeSecret(text)).withContext(text).toBeFalse();
    }
  });

  it('refuses a secret in a text answer or a structured field, with the same message as the server', () => {
    const text = validateForComplete(DEFINITION, { name: 'Sunrise', price: 'password: hunter2hunter2', hours: { weekdays: '9-5' } });
    expect(text.find((i) => i.key === 'price')?.message).toBe(SECRET_MESSAGE);

    const structured = validateForComplete(DEFINITION, { name: 'Sunrise', price: 'Rs 500', hours: { weekdays: 'api key = abcd1234efgh' } });
    expect(structured.find((i) => i.key === 'hours')?.message).toBe(SECRET_MESSAGE);
  });
});

describe('questionnaire engine: steps', () => {
  it('groups the asked questions by their group in order of first appearance', () => {
    const asked = visibleKeys(DEFINITION, { has_branch: true });

    const result = steps(DEFINITION, asked).map((step) => step.map((q) => q.key));

    expect(result).toEqual([['name'], ['price', 'has_branch', 'branch_city'], ['hours'], ['after_branch']]);
  });

  it('drops a step whose questions are all hidden, and treats an ungrouped question as a step of its own', () => {
    const asked = visibleKeys(DEFINITION, { has_branch: false });

    const result = steps(DEFINITION, asked).map((step) => step.map((q) => q.key));

    expect(result).toEqual([['name'], ['price', 'has_branch'], ['hours'], ['after_branch']]);
  });

  it('matches group names without regard to case or surrounding spaces', () => {
    const definition: QuestionnaireDefinition = {
      questions: [
        { key: 'a', type: 'ShortText', prompt: 'A?', group: 'About' },
        { key: 'b', type: 'ShortText', prompt: 'B?', group: ' about ' },
      ],
    };

    expect(steps(definition, new Set(['a', 'b'])).map((s) => s.map((q) => q.key))).toEqual([['a', 'b']]);
  });
});
