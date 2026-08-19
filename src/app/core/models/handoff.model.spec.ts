import { HandoffStatus, canClaimHandoff, canResolveHandoff } from './handoff.model';

/** Mirrors HandoffService.ClaimAsync's remarks: re-claiming an already-Assigned handoff
 * reassigns it rather than failing, so Claim/Resolve are offered for anything not Resolved. */
describe('canClaimHandoff', () => {
  it('is true for everything except Resolved', () => {
    expect(canClaimHandoff(HandoffStatus.Pending)).toBeTrue();
    expect(canClaimHandoff(HandoffStatus.Assigned)).toBeTrue();
    expect(canClaimHandoff(HandoffStatus.InProgress)).toBeTrue();
    expect(canClaimHandoff(HandoffStatus.Resolved)).toBeFalse();
  });
});

describe('canResolveHandoff', () => {
  it('is true for everything except Resolved', () => {
    expect(canResolveHandoff(HandoffStatus.Pending)).toBeTrue();
    expect(canResolveHandoff(HandoffStatus.Assigned)).toBeTrue();
    expect(canResolveHandoff(HandoffStatus.InProgress)).toBeTrue();
    expect(canResolveHandoff(HandoffStatus.Resolved)).toBeFalse();
  });
});
