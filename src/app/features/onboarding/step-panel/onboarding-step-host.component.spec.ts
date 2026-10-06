import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { BillingModule } from '../../billing/billing.module';
import { BusinessProfileModule } from '../../business-profile/business-profile.module';
import { CampaignsModule } from '../../campaigns/campaigns.module';
import { CustomersModule } from '../../customers/customers.module';
import { KnowledgeBaseModule } from '../../knowledge-base/knowledge-base.module';
import { LeadDiscoveryModule } from '../../lead-discovery/lead-discovery.module';
import { MessageTemplatesModule } from '../../message-templates/message-templates.module';
import { PackagesModule } from '../../packages/packages.module';
import { TenantSettingsModule } from '../../tenant-settings/tenant-settings.module';
import { OnboardingModule } from '../onboarding.module';
import { OnboardingStepHostComponent } from './onboarding-step-host.component';

/**
 * The real screens, loaded from their real feature modules, exactly as the onboarding panel shows them. Their API
 * calls go nowhere (HttpClientTestingModule); what matters is that each screen is found and renders in place.
 */
describe('OnboardingStepHostComponent with the real step screens', () => {
  let fixture: ComponentFixture<OnboardingStepHostComponent>;

  const auth = {
    currentUser$: of({ id: 'u1', fullName: 'Admin', email: 'a@example.com', roles: ['Admin'] }),
    currentUser: { id: 'u1', roles: ['Admin'] },
    isAuthenticated: true,
    isImpersonating: false,
    hasAnyRole: (roles: string[]) => roles.length === 0 || roles.includes('Admin'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      // The feature modules are imported only so the test compiler applies each one's template scope up front. The
      // panel loads them itself (createNgModule); in a JIT test that scope would otherwise depend on which spec
      // happened to touch the module first. The production build resolves it ahead of time.
      imports: [
        OnboardingModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
        RouterTestingModule,
        BusinessProfileModule,
        BillingModule,
        PackagesModule,
        LeadDiscoveryModule,
        TenantSettingsModule,
        MessageTemplatesModule,
        CustomersModule,
        CampaignsModule,
        KnowledgeBaseModule,
      ],
      providers: [{ provide: AuthService, useValue: auth }],
    });
    fixture = TestBed.createComponent(OnboardingStepHostComponent);
  });

  async function show(url: string): Promise<HTMLElement> {
    const host = fixture.componentInstance;
    host.url = url;
    fixture.detectChanges();
    host.ngOnChanges();
    for (let i = 0; i < 50 && host.loading; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    fixture.detectChanges();
    expect(host.failed).withContext(`${url} could not be shown`).toBeFalse();
    return fixture.nativeElement as HTMLElement;
  }

  const cases: [string, string][] = [
    ['/profile', 'app-business-profile'],
    ['/billing', 'app-billing-list'],
    ['/packages', 'app-package-list'],
    ['/lead-discovery/profile', 'app-lead-discovery-profile'],
    ['/tenant-settings', 'app-tenant-settings-list'],
    ['/message-templates', 'app-template-list'],
    ['/customers', 'app-customer-list'],
    ['/campaigns', 'app-campaign-list'],
    ['/knowledge-base', 'app-article-list'],
  ];

  for (const [url, selector] of cases) {
    it(`shows ${url} in place`, async () => {
      const root = await show(url);
      expect(root.querySelector(selector)).withContext(selector).toBeTruthy();
    });
  }

  it('says when the screen has arrived, once per url', async () => {
    let arrived = 0;
    fixture.componentInstance.rendered.subscribe(() => arrived++);

    await show('/customers');
    expect(arrived).toBe(1);

    await show('/campaigns');
    expect(arrived).toBe(2);
  });

  it('shows a detail screen with its :id, as the router would', async () => {
    const root = await show('/campaigns/3f6f2c1e-0000-4000-8000-000000000001');
    expect(root.querySelector('app-campaign-detail')).toBeTruthy();
  });
});
