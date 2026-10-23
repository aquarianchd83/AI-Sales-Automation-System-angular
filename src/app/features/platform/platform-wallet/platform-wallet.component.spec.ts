import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';

import { WalletProvider, WalletTopUp } from '../../../core/models/platform-wallet.model';
import { PlatformWalletService } from '../../../core/services/platform-wallet.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformWalletComponent } from './platform-wallet.component';

const topUp = (id: string, date: string, provider: WalletProvider, amount: number): WalletTopUp => ({ id, date, provider, amount, addedAtUtc: '2026-10-23T10:00:00Z' });

describe('PlatformWalletComponent', () => {
  function render(items: WalletTopUp[]) {
    const summary = new BehaviorSubject({ balance: 4000, topUpCount: items.length, lastTopUpDate: items[0]?.date ?? null });
    const wallet = {
      summary$: summary.asObservable(),
      refresh: jasmine.createSpy('refresh'),
      getTopUps: jasmine.createSpy('getTopUps').and.returnValue(of({ items, totalCount: items.length, page: 1, pageSize: 25, totalPages: 1 })),
    };
    TestBed.configureTestingModule({
      declarations: [PlatformWalletComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: PlatformWalletService, useValue: wallet }],
    });
    const fixture = TestBed.createComponent(PlatformWalletComponent);
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, wallet };
  }

  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  it('shows the one balance and each top-up with its date, AI provider and amount', () => {
    const { root, wallet } = render([
      topUp('1', '2026-10-10', WalletProvider.Anthropic, 2500.5),
      topUp('2', '2026-10-01', WalletProvider.OpenAI, 1499.5),
    ]);

    expect(wallet.refresh).toHaveBeenCalled();
    expect(text(root.querySelector('.balance-value'))).toBe('₹4,000');
    const rows = Array.from(root.querySelectorAll('tr.mat-mdc-row')).map((r) => text(r));
    expect(rows[0]).toContain('Oct 10, 2026');
    expect(rows[0]).toContain('Claude');
    expect(rows[0]).toContain('₹2,500.5');
    expect(rows[1]).toContain('ChatGPT');
  });

  it('says so when nothing has been added yet', () => {
    const { root } = render([]);

    expect(text(root.querySelector('.empty-state'))).toContain('No credit added yet');
  });
});
