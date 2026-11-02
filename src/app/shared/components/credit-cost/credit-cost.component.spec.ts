import { TestBed } from '@angular/core/testing';

import { EntitlementsStore } from '../../../core/services/entitlements.store';
import { SharedModule } from '../../shared.module';
import { CreditCostComponent } from './credit-cost.component';

describe('CreditCostComponent', () => {
  const costs: Record<number, { credits: number; unitLabel: string }> = {
    5: { credits: 5, unitLabel: 'action' },
    6: { credits: 1, unitLabel: 'action' },
  };

  function render(setup: (c: CreditCostComponent) => void): string {
    TestBed.configureTestingModule({
      imports: [SharedModule],
      providers: [{ provide: EntitlementsStore, useValue: { costOf: (s: number) => costs[s] ?? null } }],
    });
    const fixture = TestBed.createComponent(CreditCostComponent);
    setup(fixture.componentInstance);
    fixture.detectChanges();
    return (fixture.nativeElement.textContent ?? '').replace(/\s+/g, ' ').trim();
  }

  it('names the price of each action it is given', () => {
    expect(render((c) => (c.scenarios = [5, 6]))).toContain('Uses 5 credits per action · 1 credit per action');
  });

  it('says Free, and that the replies are recorded with 0 credits, for a screen that takes no credits', () => {
    const text = render((c) => (c.free = true));

    expect(text).toContain('Free - uses no credits, but each reply is recorded in the credit history with 0 credits');
    expect(text).not.toContain('per action');
  });

  it('does not name a price when it is free, even if actions are given', () => {
    expect(render((c) => {
      c.free = true;
      c.scenarios = [5, 6];
    })).not.toContain('Uses 5 credits');
  });
});
