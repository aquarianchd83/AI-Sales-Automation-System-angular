import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { QuotaEntryType, QuotaLedgerQuery } from '../../../core/models/billing.model';
import { SharedModule } from '../../shared.module';
import { CreditHistoryComponent } from './credit-history.component';

describe('CreditHistoryComponent', () => {
  let fixture: ComponentFixture<CreditHistoryComponent>;
  let component: CreditHistoryComponent;
  let fetchLedger: jasmine.Spy;
  let fetchSummary: jasmine.Spy;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (e: Element) => (e.textContent ?? '').replace(/\s+/g, ' ');

  beforeEach(() => {
    fetchLedger = jasmine.createSpy('fetchLedger').and.callFake((q: QuotaLedgerQuery) =>
      of({
        items: [
          { id: 'l1', entryType: QuotaEntryType.Purchase, unitsDelta: 500, balanceAfter: 500, occurredAtUtc: '2026-10-23T10:00:00Z' },
          { id: 'l2', entryType: QuotaEntryType.Consumption, unitsDelta: -12, balanceAfter: 488, feature: 'LeadDiscovery', occurredAtUtc: '2026-10-24T10:00:00Z' },
        ],
        totalCount: 2,
        page: q.page ?? 1,
        pageSize: 10,
      })
    );
    fetchSummary = jasmine.createSpy('fetchSummary').and.callFake((_days: number, filter: { entryType?: number }) =>
      of({
        totalEntries: 3,
        byEntryType: [
          { entryType: QuotaEntryType.Purchase, count: 1, units: 500 },
          { entryType: QuotaEntryType.Consumption, count: 2, units: -62 },
        ],
        byFeature: [{ feature: 'LeadDiscovery', count: 2, unitsUsed: 62 }],
        daily: [
          { date: '2026-10-22', purchased: 0, used: 0 },
          { date: '2026-10-23', purchased: 500, used: 0 },
          { date: '2026-10-24', purchased: 0, used: filter.entryType === QuotaEntryType.Purchase ? 0 : 62 },
        ],
      })
    );

    TestBed.configureTestingModule({ imports: [SharedModule, NoopAnimationsModule] });
    fixture = TestBed.createComponent(CreditHistoryComponent);
    component = fixture.componentInstance;
    component.fetchLedger = fetchLedger;
    component.fetchSummary = fetchSummary;
    fixture.detectChanges();
  });

  it('shows a stat tile for every value the history can be narrowed to, totalled over the whole range', () => {
    const tiles = Array.from(root().querySelectorAll('.ledger-tile')).map((t) => text(t));

    expect(tiles.length).toBe(8);
    expect(tiles[0]).toContain('All activity');
    expect(tiles[0]).toContain('3');
    expect(tiles[1]).toContain('Purchased');
    expect(tiles[1]).toContain('500');
    expect(tiles[2]).toContain('Used');
    expect(tiles[2]).toContain('62');
    expect(tiles.find((t) => t.includes('Lead discovery'))).toContain('62');
  });

  it('draws the daily graph, and narrows both the graph and the entries when a tile is clicked', () => {
    expect(root().querySelectorAll('svg rect.chart-bar').length).toBe(2);

    (root().querySelectorAll('.ledger-tile')[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fetchLedger.calls.mostRecent().args[0].entryType).toBe(QuotaEntryType.Purchase);
    expect(fetchSummary.calls.mostRecent().args[1].entryType).toBe(QuotaEntryType.Purchase);
    expect(root().querySelectorAll('svg rect.chart-bar').length).toBe(1);
    expect(text(root().querySelector('.ledger-chart-head')!)).toContain('Purchased');
    expect(root().querySelectorAll('.ledger-tile').length).toBe(8);
  });

  it('applies the picked dates only when Filter is clicked, to the entries, tiles and graph, and clears them again', () => {
    const calls = fetchLedger.calls.count();
    component.fromControl.setValue(new Date(2026, 9, 1));
    component.toControl.setValue(new Date(2026, 9, 24));
    fixture.detectChanges();
    expect(fetchLedger.calls.count()).toBe(calls);

    const filterButton = Array.from(root().querySelectorAll('button')).find((b) => b.textContent?.includes('Filter')) as HTMLButtonElement;
    expect(filterButton.disabled).toBeFalse();
    filterButton.click();
    fixture.detectChanges();

    expect(fetchLedger.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ from: '2026-10-01', to: '2026-10-24', page: 1 }));
    expect(fetchSummary.calls.mostRecent().args[1]).toEqual(jasmine.objectContaining({ from: '2026-10-01', to: '2026-10-24' }));
    expect(component.chartPeriod).toBe('2026-10-01 to 2026-10-24');

    component.clearRange();
    expect(fetchLedger.calls.mostRecent().args[0].from).toBeUndefined();
    expect(component.chartPeriod).toBe('Last 30 days');
  });

  it('lists the entries with what happened, a green + or red - amount, and the balance after', () => {
    component.showEntries = true;
    fixture.detectChanges();

    const rows = Array.from(root().querySelectorAll('tr.mat-mdc-row')).map((r) => text(r));
    const amounts = Array.from(root().querySelectorAll('.ledger-amount')) as HTMLElement[];

    expect(rows[0]).toContain('Purchased');
    expect(rows[0]).toContain('+500');
    expect(rows[1]).toContain('Used');
    expect(rows[1]).toContain('Lead discovery');
    expect(rows[1]).toContain('488');
    expect(amounts[0].classList).toContain('ledger-amount--in');
    expect(amounts[1].textContent?.trim()).toBe('-12');
    expect(amounts[1].classList).toContain('ledger-amount--out');
  });
});
