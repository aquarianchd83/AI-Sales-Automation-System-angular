import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { WalletProvider } from '../../../core/models/platform-wallet.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformWalletService } from '../../../core/services/platform-wallet.service';
import { SharedModule } from '../../shared.module';
import { PlatformWalletTopUpDialogComponent, toDateOnly } from './platform-wallet-top-up-dialog.component';

describe('PlatformWalletTopUpDialogComponent', () => {
  function setup() {
    const wallet = jasmine.createSpyObj<PlatformWalletService>('PlatformWalletService', ['addTopUp']);
    wallet.addTopUp.and.returnValue(of({ id: '1', date: '2026-10-23', provider: WalletProvider.Anthropic, amount: 500, addedAtUtc: '' }));
    const dialogRef = jasmine.createSpyObj<MatDialogRef<PlatformWalletTopUpDialogComponent, boolean>>('MatDialogRef', ['close']);
    const notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['success']);

    TestBed.configureTestingModule({
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformWalletService, useValue: wallet },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const fixture = TestBed.createComponent(PlatformWalletTopUpDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, wallet, dialogRef };
  }

  it('lists the three AI providers by the names the admin knows', () => {
    const { component } = setup();

    expect(component.providers.map((p) => p.label)).toEqual(['ChatGPT', 'Claude', 'Gemini']);
  });

  it('will not save without a provider and an amount above zero', () => {
    const { component, wallet } = setup();

    component.submit();
    expect(wallet.addTopUp).not.toHaveBeenCalled();

    component.form.patchValue({ provider: WalletProvider.Google, amount: 0 });
    component.submit();
    expect(wallet.addTopUp).not.toHaveBeenCalled();
  });

  it('sends the date as a plain day, the provider and the amount, then closes', () => {
    const { component, wallet, dialogRef } = setup();

    component.form.patchValue({ date: new Date(2026, 9, 23, 23, 30), provider: WalletProvider.Anthropic, amount: 500 });
    component.submit();

    expect(wallet.addTopUp).toHaveBeenCalledOnceWith({ date: '2026-10-23', provider: WalletProvider.Anthropic, amount: 500 });
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('turns a local date into yyyy-MM-dd without shifting the day', () => {
    expect(toDateOnly(new Date(2026, 0, 5, 0, 5))).toBe('2026-01-05');
    expect(toDateOnly(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});
