import { LeadStage, canEditLead } from './lead.model';

describe('canEditLead', () => {
  it('is false only for Won and Lost — a closed-out deal is history', () => {
    expect(canEditLead(LeadStage.Won)).toBeFalse();
    expect(canEditLead(LeadStage.Lost)).toBeFalse();
  });

  it('is true for every stage still in play', () => {
    expect(canEditLead(LeadStage.New)).toBeTrue();
    expect(canEditLead(LeadStage.Qualifying)).toBeTrue();
    expect(canEditLead(LeadStage.Qualified)).toBeTrue();
    expect(canEditLead(LeadStage.Negotiation)).toBeTrue();
  });
});
