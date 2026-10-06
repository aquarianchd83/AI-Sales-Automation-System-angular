import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';

import { OnboardingStatus, OnboardingStepState } from '../../core/models/onboarding.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { OnboardingService } from '../../core/services/onboarding.service';
import { BillingModule } from '../billing/billing.module';
import { BusinessProfileModule } from '../business-profile/business-profile.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { CustomersModule } from '../customers/customers.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { LeadDiscoveryModule } from '../lead-discovery/lead-discovery.module';
import { MessageTemplatesModule } from '../message-templates/message-templates.module';
import { PackagesModule } from '../packages/packages.module';
import { TenantSettingsModule } from '../tenant-settings/tenant-settings.module';
import { OnboardingPageComponent } from './onboarding-page/onboarding-page.component';
import { OnboardingModule } from './onboarding.module';

const STEPS: [string, string, number, string, string][] = [
  ['profile', 'Profile Information', 10, '/profile', 'app-business-profile'],
  ['plan', 'Select Package Plan', 10, '/billing', 'app-billing-list'],
  ['customer-package', 'Create Customer Package', 15, '/packages', 'app-package-list'],
  ['lead-discovery', 'Lead Discovery Profile', 10, '/lead-discovery/profile', 'app-lead-discovery-profile'],
  ['whatsapp', 'WhatsApp Configuration', 15, '/tenant-settings', 'app-tenant-settings-list'],
  ['message-template', 'Configure Message Template', 10, '/message-templates', 'app-template-list'],
  ['customer', 'Create Customer', 10, '/customers', 'app-customer-list'],
  ['campaign', 'Create Campaign', 10, '/campaigns', 'app-campaign-list'],
  ['knowledge-base', 'Knowledge Base / Voucher', 10, '/knowledge-base', 'app-article-list'],
];

/** Every step done except the last, so Previous and Next both have somewhere to go all the way along. */
function status(): OnboardingStatus {
  const steps = STEPS.map(([key, title, weight, route], i) => ({
    key, title, description: '', weight, route,
    state: (i === STEPS.length - 1 ? 'Current' : 'Completed') as OnboardingStepState,
    completedAt: i === STEPS.length - 1 ? null : '2026-10-06T08:00:00Z',
    missing: null,
  }));
  return { isCompleted: false, progressPercent: 90, currentStepKey: steps[STEPS.length - 1].key, completedAt: null, steps };
}

/**
 * The onboarding page with the REAL step screens: what the panel actually shows after Next and Previous, not just
 * which step is selected.
 */
describe('Onboarding page navigation with the real screens', () => {
  let fixture: ComponentFixture<OnboardingPageComponent>;
  let component: OnboardingPageComponent;

  const root = (): HTMLElement => fixture.nativeElement;
  const body = (): HTMLElement => root().querySelector('.panel-body')!;
  const nav = (label: string): HTMLButtonElement =>
    Array.from(root().querySelectorAll<HTMLButtonElement>('.panel-nav button')).find((b) => b.textContent!.includes(label))!;

  async function settle(): Promise<void> {
    for (let i = 0; i < 6; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    fixture.detectChanges();
  }

  beforeEach(async () => {
    const status$ = new BehaviorSubject<OnboardingStatus | null>(status());
    const onboarding = jasmine.createSpyObj<OnboardingService>('OnboardingService', ['refresh'], { status$: status$.asObservable() });
    onboarding.refresh.and.returnValue(of(status()));

    TestBed.configureTestingModule({
      imports: [
        OnboardingModule, HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule,
        BusinessProfileModule, BillingModule, PackagesModule, LeadDiscoveryModule, TenantSettingsModule,
        MessageTemplatesModule, CustomersModule, CampaignsModule, KnowledgeBaseModule,
      ],
      providers: [
        { provide: OnboardingService, useValue: onboarding },
        {
          provide: AuthService,
          useValue: {
            hasAnyRole: (wanted: string[]) => wanted.length === 0 || wanted.includes('Admin'),
            currentUser: { id: 'u1', roles: ['Admin'] },
            currentUser$: of({ id: 'u1', fullName: 'Admin', email: 'a@example.com', roles: ['Admin'] }),
            isAuthenticated: true,
            isImpersonating: false,
          },
        },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'info', 'error']) },
      ],
    });
    fixture = TestBed.createComponent(OnboardingPageComponent);
    component = fixture.componentInstance;
    await settle();
  });

  it('shows the step on screen first, then each step Next leads to', async () => {
    component.select(component.status!.steps[0]);
    await settle();
    expect(body().querySelector(STEPS[0][4])).withContext('profile').toBeTruthy();

    for (let i = 1; i < STEPS.length; i++) {
      nav('Next').click();
      await settle();

      expect(component.selected?.key).withContext(`step ${i + 1} selected`).toBe(STEPS[i][0]);
      expect(component.panelUrl).withContext(`step ${i + 1} url`).toBe(STEPS[i][3]);
      expect(body().querySelector(STEPS[i][4])).withContext(`${STEPS[i][1]} screen is shown`).toBeTruthy();
      expect(body().querySelector(STEPS[i - 1][4])).withContext(`${STEPS[i - 1][1]} screen is gone`).toBeNull();
    }
  });

  it('and back again with Previous', async () => {
    component.select(component.status!.steps[3]);
    await settle();

    nav('Previous').click();
    await settle();
    expect(body().querySelector(STEPS[2][4])).withContext('packages').toBeTruthy();
    expect(body().querySelector(STEPS[3][4])).toBeNull();

    nav('Previous').click();
    await settle();
    expect(body().querySelector(STEPS[1][4])).withContext('billing').toBeTruthy();
  });
});
