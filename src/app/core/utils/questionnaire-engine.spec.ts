import { AnswerMap, QuestionnaireDefinition } from '../models/content-studio.model';
import { evaluate, isAnswered, prune, validateForComplete, visibleKeys } from './questionnaire-engine';

// The same questionnaire and the same cases as the API's QuestionnaireEngineTests: the screen and the server must agree.
const DEFINITION: QuestionnaireDefinition = {
  questions: [
    { key: 'name', type: 'ShortText', prompt: 'Name?', required: true },
    { key: 'has_surgery', type: 'Boolean', prompt: 'Surgery?' },
    {
      key: 'surgery_types',
      type: 'MultiChoice',
      prompt: 'Which?',
      required: true,
      options: [
        { value: 'cataract', label: 'Cataract' },
        { value: 'lasik', label: 'LASIK' },
        { value: 'retina', label: 'Retina' },
      ],
      showWhen: { questionKey: 'has_surgery', operator: 'Equal', value: true },
    },
    {
      key: 'lasik_price',
      type: 'Number',
      prompt: 'LASIK price?',
      min: 0,
      max: 500000,
      showWhen: {
        all: [
          { questionKey: 'has_surgery', operator: 'Equal', value: true },
          { questionKey: 'surgery_types', operator: 'Contains', value: 'lasik' },
        ],
      },
    },
    {
      key: 'hours',
      type: 'Structured',
      prompt: 'Hours?',
      fields: [
        { key: 'weekdays', label: 'Mon-Fri', type: 'ShortText', required: true },
        { key: 'saturday', label: 'Saturday', type: 'ShortText' },
      ],
    },
  ],
};

describe('questionnaire engine (browser copy)', () => {
  it('asks a conditional question only when its condition holds', () => {
    expect(visibleKeys(DEFINITION, {}).has('surgery_types')).toBeFalse();
    expect(visibleKeys(DEFINITION, { has_surgery: false }).has('surgery_types')).toBeFalse();
    expect(visibleKeys(DEFINITION, { has_surgery: true }).has('surgery_types')).toBeTrue();
  });

  it('hides the questions that depend on a hidden one', () => {
    const on: AnswerMap = { has_surgery: true, surgery_types: ['lasik'] };
    expect(visibleKeys(DEFINITION, on).has('lasik_price')).toBeTrue();

    const off: AnswerMap = { has_surgery: false, surgery_types: ['lasik'] };
    const visible = visibleKeys(DEFINITION, off);
    expect(visible.has('surgery_types')).toBeFalse();
    expect(visible.has('lasik_price')).toBeFalse();
  });

  it('needs every part of All, and a multiple choice that includes the value', () => {
    expect(visibleKeys(DEFINITION, { has_surgery: true, surgery_types: ['cataract'] }).has('lasik_price')).toBeFalse();
    expect(visibleKeys(DEFINITION, { has_surgery: true, surgery_types: ['cataract', 'lasik'] }).has('lasik_price')).toBeTrue();
  });

  it('never keeps the answer to a hidden question, or an empty one', () => {
    const kept = prune(DEFINITION, {
      name: 'Clinic',
      has_surgery: false,
      surgery_types: ['lasik'],
      lasik_price: 1000,
      nonsense: 'x',
    });
    expect(Object.keys(kept).sort()).toEqual(['has_surgery', 'name']);

    expect(Object.keys(prune(DEFINITION, { name: '   ', has_surgery: false, hours: { weekdays: '' } }))).toEqual(['has_surgery']);
  });

  it('treats false and 0 as answers', () => {
    expect(isAnswered(false)).toBeTrue();
    expect(isAnswered(0)).toBeTrue();
    expect(isAnswered('')).toBeFalse();
    expect(isAnswered([])).toBeFalse();
    expect(isAnswered(null)).toBeFalse();
  });

  const cases: [string, unknown, unknown, boolean][] = [
    ['Equal', 'Yes', 'yes', true],
    ['NotEqual', 'a', 'b', true],
    ['In', 'b', ['a', 'b'], true],
    ['In', 'c', ['a', 'b'], false],
    ['GreaterThan', 10, 5, true],
    ['LessThan', 10, 5, false],
    ['Contains', 'Hello World', 'world', true],
  ];
  cases.forEach(([operator, answer, value, expected]) => {
    it(`compares with ${operator}: ${JSON.stringify(answer)} vs ${JSON.stringify(value)}`, () => {
      expect(evaluate({ questionKey: 'q', operator: operator as never, value }, { q: answer as never })).toBe(expected);
    });
  });

  it('fails every comparison for a missing answer except the negative ones', () => {
    expect(evaluate({ questionKey: 'q', operator: 'Equal', value: 'x' }, {})).toBeFalse();
    expect(evaluate({ questionKey: 'q', operator: 'NotEqual', value: 'x' }, {})).toBeTrue();
    expect(evaluate({ questionKey: 'q', operator: 'NotAnswered' }, {})).toBeTrue();
    expect(evaluate({ questionKey: 'q', operator: 'Answered' }, {})).toBeFalse();
  });

  it('needs just one part of Any', () => {
    const condition = {
      any: [
        { questionKey: 'a', operator: 'Equal' as const, value: true },
        { questionKey: 'b', operator: 'Equal' as const, value: true },
      ],
    };
    expect(evaluate(condition, { b: true })).toBeTrue();
    expect(evaluate(condition, { a: false, b: false })).toBeFalse();
  });

  it('never requires a hidden question', () => {
    const issues = validateForComplete(DEFINITION, { name: 'Clinic', has_surgery: false, hours: { weekdays: '9-5' } });
    expect(issues).toEqual([]);
  });

  it('requires an asked, required question, and the required fields of a structured answer', () => {
    const issues = validateForComplete(DEFINITION, { name: 'Clinic', has_surgery: true, hours: { saturday: '9-1' } });

    expect(issues.map((i) => i.key).sort()).toEqual(['hours.weekdays', 'surgery_types']);
  });

  it('refuses an answer of the wrong kind or out of range', () => {
    const issues = validateForComplete(DEFINITION, {
      name: 'Clinic',
      has_surgery: true,
      surgery_types: ['lasik', 'bogus'],
      lasik_price: -5,
      hours: { weekdays: '9-5' },
    });

    expect(issues.find((i) => i.key === 'surgery_types')?.message).toContain('listed options');
    expect(issues.find((i) => i.key === 'lasik_price')?.message).toContain('at least 0');
  });
});
