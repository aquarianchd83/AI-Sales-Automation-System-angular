import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { BillingService } from '../../../core/services/billing.service';
import { BillingModule } from '../billing.module';

@Component({ template: '<router-outlet></router-outlet>' })
class HostComponent {}

describe('credit-costs route', () => {
  it('is reachable under the billing module', async () => {
    TestBed.configureTestingModule({
      declarations: [HostComponent],
      imports: [
        NoopAnimationsModule,
        RouterTestingModule.withRoutes([{ path: 'billing', loadChildren: () => Promise.resolve(BillingModule) }]),
      ],
      providers: [{ provide: BillingService, useValue: { getWallet: () => of({ balance: 0, planName: null, features: [] }) } }],
    });
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const ok = await router.navigateByUrl('/billing/credit-costs');
    fixture.detectChanges();

    expect(ok).toBeTrue();
    expect(router.url).toBe('/billing/credit-costs');
    expect(fixture.nativeElement.querySelector('app-credit-costs')).not.toBeNull();
  });
});
