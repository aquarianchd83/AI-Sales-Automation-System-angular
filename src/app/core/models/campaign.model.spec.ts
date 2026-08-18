import {
  CampaignStatus,
  campaignEndDate,
  canDeleteCampaign,
  canPauseCampaign,
  canResumeCampaign,
  canRunCampaignJobs,
  canStartCampaign,
  canStopCampaign,
  formatStepTypeName,
  isLastStep,
  nextStepNumber,
  parseStepTypeName,
  toScheduledStartAtRequest,
  toTimeInputValue,
} from './campaign.model';

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

/**
 * Mirror CampaignService's RequireStatus calls in StartAsync/PauseAsync/StopAsync
 * (ResumeAsync is an alias for StartAsync) — pinned so a backend transition-rule change
 * shows up here instead of as a silent 409 behind a button the UI still offers.
 */
/**
 * The backend reads ScheduledStartAt's literal digits as IST, ignoring any offset/'Z'
 * suffix — Date.toISOString() converts through UTC first, which is exactly what caused
 * a locally-picked date to silently land on the previous day server-side. This must
 * write the Date's own local fields untouched, with no UTC conversion.
 */
describe('toScheduledStartAtRequest', () => {
  it('writes the local calendar date/time, not the UTC-shifted one', () => {
    // A local midnight pick — the datepicker's actual output shape (date-only, no time UI).
    const localMidnight = new Date(2026, 7, 20, 0, 0, 0); // August (0-indexed) 20 2026, local
    expect(toScheduledStartAtRequest(localMidnight)).toBe('2026-08-20T00:00:00');
  });

  it('pads single-digit month, day, hour, minute and second', () => {
    const date = new Date(2026, 0, 5, 3, 4, 5); // Jan 5 2026, 03:04:05 local
    expect(toScheduledStartAtRequest(date)).toBe('2026-01-05T03:04:05');
  });

  it('overrides the date\'s own time with an "HH:mm" time argument, seconds zeroed', () => {
    const datePickerValue = new Date(2026, 7, 20, 0, 0, 0); // midnight, as the datepicker sets it
    expect(toScheduledStartAtRequest(datePickerValue, '14:30')).toBe('2026-08-20T14:30:00');
  });

  it('pads a single-digit hour/minute in the time argument', () => {
    const date = new Date(2026, 7, 20);
    expect(toScheduledStartAtRequest(date, '9:5')).toBe('2026-08-20T09:05:00');
  });
});

describe('toTimeInputValue', () => {
  it('formats HH:mm, zero-padded, for a native time input', () => {
    expect(toTimeInputValue(new Date(2026, 7, 20, 9, 5))).toBe('09:05');
    expect(toTimeInputValue(new Date(2026, 7, 20, 23, 59))).toBe('23:59');
  });
});

describe('canDeleteCampaign', () => {
  it('is true for Draft and Stopped only — DeleteAsync now allows both', () => {
    expect(canDeleteCampaign(CampaignStatus.Draft)).toBeTrue();
    expect(canDeleteCampaign(CampaignStatus.Stopped)).toBeTrue();
  });

  it('is false for Scheduled, Running, Paused and Completed', () => {
    expect(canDeleteCampaign(CampaignStatus.Scheduled)).toBeFalse();
    expect(canDeleteCampaign(CampaignStatus.Running)).toBeFalse();
    expect(canDeleteCampaign(CampaignStatus.Paused)).toBeFalse();
    expect(canDeleteCampaign(CampaignStatus.Completed)).toBeFalse();
  });
});

describe('canStartCampaign', () => {
  it('is true only for Draft', () => {
    expect(canStartCampaign(CampaignStatus.Draft)).toBeTrue();
    expect(canStartCampaign(CampaignStatus.Paused)).toBeFalse();
    expect(canStartCampaign(CampaignStatus.Stopped)).toBeFalse();
  });
});

describe('canResumeCampaign', () => {
  it('is true for Paused and Stopped — StartAsync now accepts both', () => {
    expect(canResumeCampaign(CampaignStatus.Paused)).toBeTrue();
    expect(canResumeCampaign(CampaignStatus.Stopped)).toBeTrue();
  });

  it('is false for Draft, Running, Scheduled and Completed', () => {
    expect(canResumeCampaign(CampaignStatus.Draft)).toBeFalse();
    expect(canResumeCampaign(CampaignStatus.Running)).toBeFalse();
    expect(canResumeCampaign(CampaignStatus.Scheduled)).toBeFalse();
    expect(canResumeCampaign(CampaignStatus.Completed)).toBeFalse();
  });
});

describe('canPauseCampaign', () => {
  it('is true for Running and Scheduled only', () => {
    expect(canPauseCampaign(CampaignStatus.Running)).toBeTrue();
    expect(canPauseCampaign(CampaignStatus.Scheduled)).toBeTrue();
    expect(canPauseCampaign(CampaignStatus.Paused)).toBeFalse();
    expect(canPauseCampaign(CampaignStatus.Stopped)).toBeFalse();
  });
});

describe('canStopCampaign', () => {
  it('is true for everything except Stopped and Completed', () => {
    expect(canStopCampaign(CampaignStatus.Draft)).toBeTrue();
    expect(canStopCampaign(CampaignStatus.Scheduled)).toBeTrue();
    expect(canStopCampaign(CampaignStatus.Running)).toBeTrue();
    expect(canStopCampaign(CampaignStatus.Paused)).toBeTrue();
    expect(canStopCampaign(CampaignStatus.Stopped)).toBeFalse();
    expect(canStopCampaign(CampaignStatus.Completed)).toBeFalse();
  });
});

describe('canRunCampaignJobs', () => {
  it('is true for Scheduled and Running only — the only statuses the send pipeline acts on', () => {
    expect(canRunCampaignJobs(CampaignStatus.Scheduled)).toBeTrue();
    expect(canRunCampaignJobs(CampaignStatus.Running)).toBeTrue();
  });

  it('is false for Draft, Paused, Stopped and Completed — guaranteed no-ops server-side', () => {
    expect(canRunCampaignJobs(CampaignStatus.Draft)).toBeFalse();
    expect(canRunCampaignJobs(CampaignStatus.Paused)).toBeFalse();
    expect(canRunCampaignJobs(CampaignStatus.Stopped)).toBeFalse();
    expect(canRunCampaignJobs(CampaignStatus.Completed)).toBeFalse();
  });
});

/**
 * CampaignDto has no end-date field — this is projected client-side. Pinned against
 * CampaignSendService.ProcessOneAsync's `now.AddDays(step.DelayDaysAfterPrevious)`
 * scheduling so a backend change to that formula shows up here too.
 */
describe('campaignEndDate', () => {
  it('is null when there is no start date at all', () => {
    expect(
      campaignEndDate({
        status: CampaignStatus.Draft,
        startedAt: null,
        scheduledStartAt: null,
        stoppedAt: null,
        steps: [],
      })
    ).toBeNull();
  });

  it('is the exact StoppedAt, not an estimate, for a Stopped campaign', () => {
    const result = campaignEndDate({
      status: CampaignStatus.Stopped,
      startedAt: '2026-01-01T00:00:00Z',
      scheduledStartAt: null,
      stoppedAt: '2026-01-05T00:00:00Z',
      steps: [{ isActive: true, delayDaysAfterPrevious: 30 }],
    });
    expect(result!.isEstimate).toBeFalse();
    expect(result!.date.toISOString()).toBe('2026-01-05T00:00:00.000Z');
  });

  it('is null when a start date exists but no step has been added yet', () => {
    expect(
      campaignEndDate({
        status: CampaignStatus.Scheduled,
        startedAt: null,
        scheduledStartAt: '2026-02-01T00:00:00Z',
        stoppedAt: null,
        steps: [],
      })
    ).toBeNull();
  });

  it('is null when every step is inactive — no active step to project from', () => {
    expect(
      campaignEndDate({
        status: CampaignStatus.Running,
        startedAt: '2026-01-01T00:00:00Z',
        scheduledStartAt: null,
        stoppedAt: null,
        steps: [{ isActive: false, delayDaysAfterPrevious: 0 }],
      })
    ).toBeNull();
  });

  it('estimates from StartedAt plus the sum of active steps’ delay, preferring StartedAt over ScheduledStartAt', () => {
    const result = campaignEndDate({
      status: CampaignStatus.Running,
      startedAt: '2026-01-01T00:00:00Z',
      scheduledStartAt: '2025-01-01T00:00:00Z',
      stoppedAt: null,
      steps: [
        { isActive: true, delayDaysAfterPrevious: 0 }, // Initial
        { isActive: true, delayDaysAfterPrevious: 3 },
        { isActive: true, delayDaysAfterPrevious: 4 },
      ],
    });
    expect(result!.isEstimate).toBeTrue();
    expect(result!.date.toISOString()).toBe('2026-01-08T00:00:00.000Z');
  });

  it('falls back to ScheduledStartAt when the campaign has not started yet', () => {
    const result = campaignEndDate({
      status: CampaignStatus.Scheduled,
      startedAt: null,
      scheduledStartAt: '2026-02-01T00:00:00Z',
      stoppedAt: null,
      steps: [{ isActive: true, delayDaysAfterPrevious: 10 }],
    });
    expect(result!.date.toISOString()).toBe('2026-02-11T00:00:00.000Z');
  });

  it('excludes inactive steps from the projection', () => {
    const result = campaignEndDate({
      status: CampaignStatus.Paused,
      startedAt: '2026-01-01T00:00:00Z',
      scheduledStartAt: null,
      stoppedAt: null,
      steps: [
        { isActive: true, delayDaysAfterPrevious: 5 },
        { isActive: false, delayDaysAfterPrevious: 100 },
      ],
    });
    expect(result!.date.toISOString()).toBe('2026-01-06T00:00:00.000Z');
  });
});
