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

  describe('Test chat', () => {
    let fetchTestChat: jasmine.Spy;

    beforeEach(() => {
      fetchTestChat = jasmine.createSpy('fetchTestChat').and.callFake((q: QuotaLedgerQuery) =>
        of({
          items: [
            { id: 't2', occurredAtUtc: '2026-10-30T13:21:30Z', model: 'OpenAI:gpt-5-nano', text: 'tell me something about it' },
            { id: 't1', occurredAtUtc: '2026-10-30T13:20:20Z', model: 'OpenAI:gpt-5-nano' },
          ],
          totalCount: 2,
          page: q.page ?? 1,
          pageSize: 10,
        })
      );
      // Rebuilt with a source for Test chat, and a summary that counts its replies.
      fetchSummary.and.callFake(() =>
        of({ totalEntries: 3, byEntryType: [], byFeature: [], daily: [{ date: '2026-10-30', purchased: 0, used: 0 }], testChatReplies: 2 })
      );
      component.fetchTestChat = fetchTestChat;
      component.ngOnInit();
      fixture.detectChanges();
    });

    const testChatTile = () => Array.from(root().querySelectorAll('.ledger-tile')).find((t) => text(t).includes('Test chat')) as HTMLButtonElement;

    it('adds a Free tile that counts the replies, apart from the credit movements', () => {
      expect(text(testChatTile())).toContain('Free');
      expect(text(testChatTile())).toContain('2 replies');
      expect(text(root().querySelectorAll('.ledger-tile')[0])).toContain('3');
    });

    it('lists the replies as zero-credit rows that leave the balance unchanged, in place of the ledger', () => {
      component.showEntries = true;
      testChatTile().click();
      fixture.detectChanges();

      const rows = Array.from(root().querySelectorAll('[data-testid=testchat-table] tr.mat-mdc-row')).map((r) => text(r));
      expect(rows.length).toBe(2);
      expect(rows[0]).toContain('Free');
      expect(rows[0]).toContain('AI conversations · Test chat: “tell me something about it”');
      expect(rows[0]).toContain('Unchanged');
      // A test made before the words were kept still reads sensibly.
      expect(rows[1]).toContain('AI conversations · Test chat reply');
      // Only the Test chat table is shown, not the ledger's.
      expect(root().querySelectorAll('table.ledger-table').length).toBe(1);
      expect(root().querySelector('[data-testid=testchat-table] table.ledger-table')).not.toBeNull();
      // The ledger was not asked for these, and none of them is a credit entry.
      expect(fetchTestChat).toHaveBeenCalled();
      expect(fetchLedger.calls.mostRecent().args[0].feature).toBeUndefined();
    });

    it('has nothing to chart, and says why', () => {
      testChatTile().click();
      fixture.detectChanges();

      expect(root().querySelectorAll('svg rect.chart-bar').length).toBe(0);
      expect(text(root().querySelector('[data-testid=testchat-note]')!)).toContain('uses no credits');
    });

    it('asks for the same days as the rest of the history', () => {
      component.fromControl.setValue(new Date(2026, 9, 1));
      component.toControl.setValue(new Date(2026, 9, 30));
      component.applyRange();
      testChatTile().click();
      fixture.detectChanges();

      expect(fetchTestChat.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ from: '2026-10-01', to: '2026-10-30', page: 1 }));
    });

    it('says so when there are no test chat replies in the selection', () => {
      fetchTestChat.and.returnValue(of({ items: [], totalCount: 0, page: 1, pageSize: 10 }));
      component.showEntries = true;
      testChatTile().click();
      fixture.detectChanges();

      expect(text(root())).toContain('No test chat replies in this selection.');
      expect(text(root())).not.toContain('No credit movements in this selection.');
    });
  });

  it('keeps Filter available once it has been used, so the same days can be searched again for what is new', () => {
    const filterButton = () => root().querySelector('[data-testid=filter]') as HTMLButtonElement;
    expect(filterButton().disabled).toBeFalse();

    component.fromControl.setValue(new Date(2026, 9, 1));
    component.toControl.setValue(new Date(2026, 9, 30));
    filterButton().click();
    fixture.detectChanges();
    expect(filterButton().disabled).toBeFalse();

    // Pressed again with nothing changed: the entries, tiles and graph are fetched again.
    const ledgerCalls = fetchLedger.calls.count();
    const summaryCalls = fetchSummary.calls.count();
    filterButton().click();
    fixture.detectChanges();

    expect(fetchLedger.calls.count()).toBe(ledgerCalls + 1);
    expect(fetchSummary.calls.count()).toBe(summaryCalls + 1);
    expect(fetchLedger.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ from: '2026-10-01', to: '2026-10-30', page: 1 }));
  });

  it('says what the customer wrote for an AI reply, instead of the bare note', () => {
    fetchLedger.and.returnValue(
      of({
        items: [
          {
            id: 'a1', entryType: QuotaEntryType.Consumption, unitsDelta: -1, balanceAfter: 802, feature: 'AiConversations', note: 'ConversationReply',
            customerText: 'Hi, I want to know about the nayan care platform', occurredAtUtc: '2026-10-29T13:40:06Z',
          },
          { id: 'a2', entryType: QuotaEntryType.Consumption, unitsDelta: -1, balanceAfter: 801, feature: 'AiConversations', note: 'ConversationReply', occurredAtUtc: '2026-10-29T13:41:06Z' },
        ],
        totalCount: 2,
        page: 1,
        pageSize: 10,
      })
    );
    component.ngOnInit();
    component.showEntries = true;
    fixture.detectChanges();

    const rows = Array.from(root().querySelectorAll('tr.mat-mdc-row')).map((r) => text(r));
    expect(rows[0]).toContain('AI conversations · Customer: “Hi, I want to know about the nayan care platform”');
    expect(rows[0]).not.toContain('ConversationReply');
    // An older entry that cannot be followed to a message keeps what it said before.
    expect(rows[1]).toContain('AI conversations · ConversationReply');
  });

  it('shows no Test chat tile on a screen that cannot list them', () => {
    expect(Array.from(root().querySelectorAll('.ledger-tile')).some((t) => text(t).includes('Test chat'))).toBeFalse();
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
