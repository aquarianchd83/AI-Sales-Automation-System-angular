import { formatStepTypeName, isLastStep, nextStepNumber, parseStepTypeName } from './campaign.model';

/**
 * These mirror CampaignStepTypeName (formatStepTypeName/parseStepTypeName) and
 * CampaignService's sequential-attach/removal rules (nextStepNumber/isLastStep) on the
 * backend — pinned here so a change to the backend's rule shows up as a failing test,
 * not a silent 400/409 in the UI.
 */
describe('formatStepTypeName', () => {
  it('names position 0 Initial', () => {
    expect(formatStepTypeName(0)).toBe('Initial');
  });

  it('names later positions FollowUp{N}', () => {
    expect(formatStepTypeName(1)).toBe('FollowUp1');
    expect(formatStepTypeName(4)).toBe('FollowUp4');
    expect(formatStepTypeName(27)).toBe('FollowUp27');
  });
});

describe('parseStepTypeName', () => {
  it('parses Initial (any case) to 0', () => {
    expect(parseStepTypeName('Initial')).toBe(0);
    expect(parseStepTypeName('initial')).toBe(0);
  });

  it('parses FollowUp{N} (any case) to N', () => {
    expect(parseStepTypeName('FollowUp1')).toBe(1);
    expect(parseStepTypeName('followup27')).toBe(27);
  });

  it('rejects FollowUp0 and FollowUp with no number', () => {
    expect(parseStepTypeName('FollowUp0')).toBeNull();
    expect(parseStepTypeName('FollowUp')).toBeNull();
  });

  it('rejects anything else', () => {
    expect(parseStepTypeName('Whenever')).toBeNull();
    expect(parseStepTypeName('')).toBeNull();
  });
});

describe('nextStepNumber', () => {
  it('is 0 (Initial) for an empty campaign', () => {
    expect(nextStepNumber([])).toBe(0);
  });

  it('is one past the highest existing step, with no upper bound', () => {
    expect(nextStepNumber([{ stepNumber: 0 }])).toBe(1);
    expect(nextStepNumber([{ stepNumber: 0 }, { stepNumber: 1 }, { stepNumber: 2 }])).toBe(3);
    expect(nextStepNumber([{ stepNumber: 0 }, { stepNumber: 50 }])).toBe(51);
  });
});

describe('isLastStep', () => {
  it('is true for the only step', () => {
    expect(isLastStep(0, [0])).toBeTrue();
  });

  it('is true for the highest-numbered step among several', () => {
    expect(isLastStep(2, [0, 1, 2])).toBeTrue();
  });

  it('is false when a later step exists', () => {
    expect(isLastStep(1, [0, 1, 2])).toBeFalse();
  });
});
