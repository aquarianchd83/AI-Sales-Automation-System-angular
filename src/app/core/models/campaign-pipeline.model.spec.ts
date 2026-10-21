import { CampaignAudienceMember, CampaignCustomerStatus, CampaignStep } from './campaign.model';
import { buildPipelineStages, isFollowUpOverdue, isOpenStage, stageKeyFor } from './campaign-pipeline.model';

function step(stepNumber: number): CampaignStep {
  return {
    id: `s${stepNumber}`,
    stepType: stepNumber === 0 ? 'Initial' : `FollowUp${stepNumber}`,
    stepNumber,
    delayDaysAfterPrevious: 1,
    messageText: null,
    messageTemplateId: null,
    messageTemplateName: null,
    isActive: true,
    mediaAssetIds: [],
  };
}

function member(status: string, currentStepNumber = -1, overrides: Partial<CampaignAudienceMember> = {}): CampaignAudienceMember {
  return {
    customerId: `c-${status}-${currentStepNumber}-${Math.random()}`,
    phoneNumberE164: '+919000000001',
    firstName: 'Asha',
    lastName: null,
    status,
    currentStepNumber,
    lastMessageSentAt: null,
    nextFollowUpDueAt: null,
    stoppedReason: null,
    ...overrides,
  };
}

describe('campaign pipeline model', () => {
  const steps = [step(0), step(1), step(2)];

  it('returns queued, one stage per step, then the end states', () => {
    const keys = buildPipelineStages(steps, []).map((s) => s.key);
    expect(keys).toEqual(['queued', 'step-0', 'step-1', 'step-2', 'responded', 'completed', 'opted-out', 'failed']);
  });

  it('puts Pending and WaitingForContent in Queued', () => {
    const stages = buildPipelineStages(steps, [member(CampaignCustomerStatus.Pending), member(CampaignCustomerStatus.WaitingForContent)]);
    expect(stages.find((s) => s.key === 'queued')!.members.length).toBe(2);
  });

  it('places AwaitingResponse by the step they last received', () => {
    const stages = buildPipelineStages(steps, [
      member(CampaignCustomerStatus.AwaitingResponse, 0),
      member(CampaignCustomerStatus.AwaitingResponse, 1),
      member(CampaignCustomerStatus.AwaitingResponse, 1),
    ]);
    expect(stages.find((s) => s.key === 'step-0')!.members.length).toBe(1);
    expect(stages.find((s) => s.key === 'step-1')!.members.length).toBe(2);
    expect(stages.find((s) => s.key === 'step-2')!.members.length).toBe(0);
  });

  it('keeps a customer on a step that was removed after they received it', () => {
    const stages = buildPipelineStages([step(0)], [member(CampaignCustomerStatus.AwaitingResponse, 3)]);
    expect(stages.find((s) => s.key === 'step-3')!.members.length).toBe(1);
  });

  it('maps each end state to its own stage', () => {
    expect(stageKeyFor(member(CampaignCustomerStatus.Responded, 0))).toBe('responded');
    expect(stageKeyFor(member(CampaignCustomerStatus.Completed, 2))).toBe('completed');
    expect(stageKeyFor(member(CampaignCustomerStatus.OptedOut, 0))).toBe('opted-out');
    expect(stageKeyFor(member(CampaignCustomerStatus.Failed, 0))).toBe('failed');
    expect(stageKeyFor(member(CampaignCustomerStatus.HandedOff, 0))).toBe('handed-off');
  });

  it('hides Handed off until somebody is in it', () => {
    expect(buildPipelineStages(steps, []).some((s) => s.key === 'handed-off')).toBeFalse();
    expect(buildPipelineStages(steps, [member(CampaignCustomerStatus.HandedOff, 0)]).some((s) => s.key === 'handed-off')).toBeTrue();
  });

  it('treats only queued and step stages as open', () => {
    const stages = buildPipelineStages(steps, []);
    expect(stages.filter(isOpenStage).map((s) => s.key)).toEqual(['queued', 'step-0', 'step-1', 'step-2']);
  });

  describe('isFollowUpOverdue', () => {
    const now = new Date('2026-10-21T10:00:00Z');

    it('is overdue when the follow-up was due earlier and the customer is still waiting', () => {
      expect(isFollowUpOverdue(member(CampaignCustomerStatus.AwaitingResponse, 0, { nextFollowUpDueAt: '2026-10-19T10:00:00Z' }), now)).toBeTrue();
    });

    it('reads a timestamp with no zone as UTC', () => {
      // 09:00 UTC is before 10:00 UTC; read as a local time in a zone ahead of UTC it would wrongly be earlier still.
      expect(isFollowUpOverdue(member(CampaignCustomerStatus.AwaitingResponse, 0, { nextFollowUpDueAt: '2026-10-21T09:00:00' }), now)).toBeTrue();
      expect(isFollowUpOverdue(member(CampaignCustomerStatus.AwaitingResponse, 0, { nextFollowUpDueAt: '2026-10-21T11:00:00' }), now)).toBeFalse();
    });

    it('is never overdue for a customer who is not waiting', () => {
      expect(isFollowUpOverdue(member(CampaignCustomerStatus.Responded, 0, { nextFollowUpDueAt: '2026-10-19T10:00:00Z' }), now)).toBeFalse();
    });
  });
});
