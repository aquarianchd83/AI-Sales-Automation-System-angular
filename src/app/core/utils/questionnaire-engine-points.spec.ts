import { QuestionnaireDefinition } from '../models/content-studio.model';
import { MAX_POINT_LENGTH, MAX_POINTS, validateForComplete } from './questionnaire-engine';

/** The mandatory "what problems does your product solve" question: a required list of points that cannot be skipped. */
const DEFINITION: QuestionnaireDefinition = {
  questions: [
    { key: 'problems_solved', type: 'PointList', prompt: 'What type of problem does your product solve?', required: true, requireKnown: true },
  ],
};

const problems = (answer: unknown) => validateForComplete(DEFINITION, { problems_solved: answer as never }).map((i) => i.message);

describe('questionnaire engine: a list of points', () => {
  it('accepts a few short, different points', () => {
    expect(problems(['Slow quotes that take days', 'No follow-up after the first visit'])).toEqual([]);
    expect(problems(['Slow quotes'])).toEqual([]);
  });

  it('needs at least one point', () => {
    expect(problems(undefined).length).toBe(1);
    expect(problems([]).length).toBe(1);
  });

  it('does not accept "I don\'t know" for it', () => {
    expect(problems({ $special: 'unknown' })[0]).toContain('real answer');
  });

  it('refuses a point that is empty, too short, too long or written twice', () => {
    expect(problems(['A real problem', ''])).toContain('Remove the empty point.');
    expect(problems(['ab'])[0]).toContain('at least 3');
    expect(problems(['x'.repeat(MAX_POINT_LENGTH + 1)])[0]).toContain(`${MAX_POINT_LENGTH} characters`);
    expect(problems(['Slow quotes', 'slow quotes'])).toContain('A point was written twice.');
  });

  it('refuses more points than the limit', () => {
    const tooMany = Array.from({ length: MAX_POINTS + 1 }, (_, i) => `Problem number ${i + 1}`);

    expect(problems(tooMany)[0]).toContain(`at most ${MAX_POINTS}`);
  });

  it('refuses something that is not a list of text', () => {
    expect(problems('Slow quotes')[0]).toContain('list of points');
    expect(problems([1, 2])[0]).toContain('must be text');
  });

  it('refuses a point that looks like a secret', () => {
    expect(problems(['My card is 4111 1111 1111 1111']).length).toBe(1);
  });
});
