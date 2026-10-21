import { parseUtc } from '../utils/utc-date';
import { CampaignAudienceMember, CampaignCustomerStatus, CampaignStep, formatStepTypeName } from './campaign.model';

/** Which family a pipeline stage belongs to — drives its colour and whether it is still "in flight". */
export type PipelineStageKind = 'queued' | 'step' | 'responded' | 'handedOff' | 'completed' | 'optedOut' | 'failed';

export interface PipelineStage {
  /** Stable key: "queued", "step-0", "step-1", …, "responded", … */
  key: string;
  label: string;
  /** One line under the stage name, so a tenant needs no training to read the board. */
  help: string;
  kind: PipelineStageKind;
  /** Set for kind 'step': the step this stage's customers last received. */
  stepNumber: number | null;
  members: CampaignAudienceMember[];
}

/** Customers still moving through the sequence — everything else has reached an end state. */
export function isOpenStage(stage: PipelineStage): boolean {
  return stage.kind === 'queued' || stage.kind === 'step';
}

/**
 * Groups a campaign's audience into pipeline stages. A customer's stage follows from CampaignCustomerStatus,
 * and for AwaitingResponse from CurrentStepNumber (the step they last received):
 *
 *   Pending / WaitingForContent          → Queued
 *   AwaitingResponse, step N             → "{Initial | FollowUpN} sent"
 *   Responded / HandedOff / Completed / OptedOut / Failed → one stage each
 *
 * One stage per configured step is always returned (even when empty) so the funnel shows the whole sequence;
 * HandedOff is only returned when somebody is in it, since nothing sets it yet. Order is the customer's
 * journey: queued, each step in order, then the end states.
 */
export function buildPipelineStages(steps: CampaignStep[], members: CampaignAudienceMember[]): PipelineStage[] {
  const stepNumbers = new Set(steps.map((s) => s.stepNumber));
  // A member can sit on a step number that is no longer configured (the step was removed after they received
  // it). Keep them visible rather than dropping them from the board.
  for (const m of members) {
    if (m.status === CampaignCustomerStatus.AwaitingResponse && m.currentStepNumber >= 0) {
      stepNumbers.add(m.currentStepNumber);
    }
  }

  const stages: PipelineStage[] = [
    {
      key: 'queued',
      label: 'Queued',
      help: 'Added to the campaign, first message not sent yet',
      kind: 'queued',
      stepNumber: null,
      members: [],
    },
    ...[...stepNumbers]
      .sort((a, b) => a - b)
      .map<PipelineStage>((n) => ({
        key: `step-${n}`,
        label: `${formatStepTypeName(n)} sent`,
        help: n === 0 ? 'First message delivered, waiting for a reply' : 'Follow-up sent, waiting for a reply',
        kind: 'step',
        stepNumber: n,
        members: [],
      })),
    {
      key: 'responded',
      label: 'Replied',
      help: 'The customer answered, automation stops here',
      kind: 'responded',
      stepNumber: null,
      members: [],
    },
    {
      key: 'handed-off',
      label: 'Handed off',
      help: 'Passed to a human agent',
      kind: 'handedOff',
      stepNumber: null,
      members: [],
    },
    {
      key: 'completed',
      label: 'No reply',
      help: 'Every step was sent and nobody replied',
      kind: 'completed',
      stepNumber: null,
      members: [],
    },
    {
      key: 'opted-out',
      label: 'Opted out',
      help: 'Asked not to be messaged again',
      kind: 'optedOut',
      stepNumber: null,
      members: [],
    },
    {
      key: 'failed',
      label: 'Failed',
      help: 'Delivery failed after every retry',
      kind: 'failed',
      stepNumber: null,
      members: [],
    },
  ];

  const byKey = new Map(stages.map((s) => [s.key, s]));
  for (const member of members) {
    const key = stageKeyFor(member);
    byKey.get(key)?.members.push(member);
  }

  return stages.filter((s) => s.kind !== 'handedOff' || s.members.length > 0);
}

/** The stage key one audience member belongs to. */
export function stageKeyFor(member: CampaignAudienceMember): string {
  switch (member.status) {
    case CampaignCustomerStatus.Pending:
    case CampaignCustomerStatus.WaitingForContent:
      return 'queued';
    case CampaignCustomerStatus.AwaitingResponse:
      // currentStepNumber is -1 until a first message sends; an AwaitingResponse member always has sent one.
      return `step-${Math.max(member.currentStepNumber, 0)}`;
    case CampaignCustomerStatus.Responded:
      return 'responded';
    case CampaignCustomerStatus.HandedOff:
      return 'handed-off';
    case CampaignCustomerStatus.Completed:
      return 'completed';
    case CampaignCustomerStatus.OptedOut:
      return 'opted-out';
    default:
      return 'failed';
  }
}

/** A follow-up is overdue when it was due before `now` and the customer is still waiting on it. */
export function isFollowUpOverdue(member: CampaignAudienceMember, now: Date = new Date()): boolean {
  if (member.status !== CampaignCustomerStatus.AwaitingResponse || !member.nextFollowUpDueAt) {
    return false;
  }
  const due = parseUtc(member.nextFollowUpDueAt);
  return !Number.isNaN(due.getTime()) && due.getTime() < now.getTime();
}
