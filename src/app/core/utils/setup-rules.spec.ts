import { SetupAnswers, SetupField, SetupFieldType } from '../models/application-setup.model';
import { answerProblem, checkAnswers, conditionMatches, displayAnswer, isBlankAnswer, visibleFieldKeys } from './setup-rules';

function field(key: string, type: SetupFieldType = 'Text', extra: Partial<SetupField> = {}): SetupField {
  return {
    id: key,
    fieldKey: key,
    label: key.replace(/_/g, ' '),
    helpText: null,
    fieldType: type,
    isRequired: false,
    defaultValue: null,
    options: [],
    validation: null,
    displayOrder: 0,
    section: 'business',
    condition: null,
    metricKey: null,
    isActive: true,
    ...extra,
  };
}

const yesNo = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

/** The client's copy of the server's rules - these cases mirror SetupEvaluatorTests on the API side. */
describe('setup rules', () => {
  describe('conditions', () => {
    it('matches by operator, ignoring case, over single answers and multi-select picks', () => {
      expect(conditionMatches('Equals', 'YES', 'yes')).toBeTrue();
      expect(conditionMatches('NotEquals', 'a', 'b')).toBeTrue();
      expect(conditionMatches('NotEquals', 'a', 'a')).toBeFalse();
      expect(conditionMatches('Contains', ['instagram', 'facebook'], 'instagram')).toBeTrue();
      expect(conditionMatches('Contains', ['facebook'], 'instagram')).toBeFalse();
      expect(conditionMatches('Contains', 'hello world', 'world')).toBeTrue();
      expect(conditionMatches('In', 'b', 'a, b ,c')).toBeTrue();
      expect(conditionMatches('In', 'z', 'a,b,c')).toBeFalse();
      expect(conditionMatches('NotEmpty', 'x', null)).toBeTrue();
      expect(conditionMatches('NotEmpty', [], null)).toBeFalse();
      expect(conditionMatches('Empty', null, null)).toBeTrue();
    });
  });

  describe('visibility', () => {
    const fields = [
      field('run_ads', 'Radio', { options: yesNo }),
      field('ad_platform', 'Dropdown', { condition: { fieldKey: 'run_ads', operator: 'Equals', value: 'yes' } }),
      field('pixel', 'Text', { condition: { fieldKey: 'ad_platform', operator: 'Equals', value: 'meta' } }),
    ];

    it('shows a dependent field only when its condition holds', () => {
      expect([...visibleFieldKeys(fields, { run_ads: 'no' })]).toEqual(['run_ads']);
      expect([...visibleFieldKeys(fields, { run_ads: 'yes' })]).toEqual(['run_ads', 'ad_platform']);
    });

    it('lets a hidden parent hide its children even when the child condition matches', () => {
      expect([...visibleFieldKeys(fields, { run_ads: 'no', ad_platform: 'meta' })]).toEqual(['run_ads']);
      expect([...visibleFieldKeys(fields, { run_ads: 'yes', ad_platform: 'meta' })]).toEqual(['run_ads', 'ad_platform', 'pixel']);
    });

    it('hides a field whose parent is unknown or that sits in a loop, and ignores inactive fields', () => {
      const odd = [
        field('orphan', 'Text', { condition: { fieldKey: 'nothing', operator: 'Equals', value: 'x' } }),
        field('a', 'Text', { condition: { fieldKey: 'b', operator: 'Equals', value: 'x' } }),
        field('b', 'Text', { condition: { fieldKey: 'a', operator: 'Equals', value: 'x' } }),
        field('off', 'Text', { isActive: false }),
      ];
      expect(visibleFieldKeys(odd, { a: 'x', b: 'x' }).size).toBe(0);
    });
  });

  describe('answers', () => {
    const cases: [SetupFieldType, string, boolean][] = [
      ['Email', 'not-an-email', false],
      ['Email', 'owner@example.com', true],
      ['Url', 'example.com', false],
      ['Url', 'ftp://example.com', false],
      ['Url', 'https://example.com/page', true],
      ['Number', '12.5', false],
      ['Number', '12', true],
      ['Decimal', '12.5', true],
      ['Decimal', 'abc', false],
      ['Currency', '-1', false],
      ['Currency', '0', true],
      ['Currency', '25000.50', true],
      ['Phone', '+91 98765 43210', true],
      ['Phone', '12', false],
      ['Phone', 'call me', false],
      ['Date', '2026-10-05', true],
      ['Date', '05/10/2026', false],
      ['Checkbox', 'maybe', false],
    ];

    cases.forEach(([type, value, valid]) => {
      it(`${type} "${value}" is ${valid ? 'accepted' : 'refused'}`, () => {
        expect(answerProblem(field('f', type), value) === null).toBe(valid);
      });
    });

    it('enforces ranges, lengths and patterns from the validation rules - and shrugs off a broken pattern', () => {
      const hours = field('hours', 'Number', { validation: { min: 1, max: 720, minLength: null, maxLength: null, pattern: null, patternMessage: null } });
      expect(answerProblem(hours, '0')).toContain('at least 1');
      expect(answerProblem(hours, '721')).toContain('at most 720');
      expect(answerProblem(hours, '24')).toBeNull();

      const code = field('code', 'Text', { validation: { min: null, max: null, minLength: null, maxLength: null, pattern: '^[A-Z]{3}$', patternMessage: 'Use three capital letters.' } });
      expect(answerProblem(code, 'ab')).toBe('Use three capital letters.');
      expect(answerProblem(code, 'ABC')).toBeNull();

      const broken = field('broken', 'Text', { validation: { min: null, max: null, minLength: null, maxLength: null, pattern: '([', patternMessage: null } });
      expect(answerProblem(broken, 'anything')).toBeNull();
    });

    it('checks choices against the options', () => {
      const objective = field('objective', 'Dropdown', { options: [{ value: 'sales', label: 'Sales' }] });
      const types = field('types', 'MultiSelect', { options: [{ value: 'images', label: 'Images' }, { value: 'videos', label: 'Videos' }] });

      expect(answerProblem(objective, 'world domination')).toContain('listed options');
      expect(answerProblem(objective, 'SALES')).toBeNull();
      expect(answerProblem(types, ['images', 'gifs'])).toContain('listed options');
      expect(answerProblem(types, ['images', 'videos'])).toBeNull();
    });

    it('treats an unticked checkbox, an empty list and whitespace as no answer', () => {
      expect(isBlankAnswer(field('c', 'Checkbox'), false)).toBeTrue();
      expect(isBlankAnswer(field('c', 'Checkbox'), true)).toBeFalse();
      expect(isBlankAnswer(field('m', 'MultiSelect'), [])).toBeTrue();
      expect(isBlankAnswer(field('t', 'Text'), '   ')).toBeTrue();
      expect(isBlankAnswer(field('t', 'Text'), null)).toBeTrue();
    });
  });

  describe('checkAnswers', () => {
    const fields = [
      field('brand', 'Text', { isRequired: true }),
      field('email', 'Email', { isRequired: true }),
      field('run_ads', 'Radio', { isRequired: true, options: yesNo }),
      field('budget', 'Currency', { isRequired: true, condition: { fieldKey: 'run_ads', operator: 'Equals', value: 'yes' } }),
    ];

    it('reports what is missing and what is wrong, for visible fields only', () => {
      const answers: SetupAnswers = { brand: 'ABC', email: 'nope', run_ads: 'no' };
      const result = checkAnswers(fields, answers);

      expect(result.missing).toEqual([]);
      expect(result.invalid.map((i) => i.fieldKey)).toEqual(['email']);
      expect(result.visible.has('budget')).toBeFalse();
    });

    it('requires a dependent field once its condition is met', () => {
      const result = checkAnswers(fields, { brand: 'ABC', email: 'a@b.co', run_ads: 'yes' });

      expect(result.missing.map((i) => i.fieldKey)).toEqual(['budget']);
      expect(result.missing[0].message).toBe('budget is required.');
    });
  });

  describe('displayAnswer', () => {
    it('reads answers back in the Talent\'s words', () => {
      const platforms = field('platforms', 'MultiSelect', { options: [{ value: 'instagram', label: 'Instagram' }, { value: 'x', label: 'X (Twitter)' }] });

      expect(displayAnswer(platforms, ['instagram', 'x'])).toBe('Instagram, X (Twitter)');
      expect(displayAnswer(field('c', 'Checkbox'), true)).toBe('Yes');
      expect(displayAnswer(field('c', 'Checkbox'), false)).toBe('No');
      expect(displayAnswer(field('b', 'Currency'), 25000, '₹')).toBe('₹25,000');
      expect(displayAnswer(field('t', 'Text'), null)).toBe('—');
    });
  });
});
