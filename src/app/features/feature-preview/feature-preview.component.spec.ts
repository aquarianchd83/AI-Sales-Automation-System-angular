import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of, throwError } from 'rxjs';

import { FEATURE_PREVIEWS } from '../../core/models/feature-preview.model';
import { PLATFORM_FEATURES, PlatformFeature, WalletSummary } from '../../core/models/wallet.model';
import { AuthService } from '../../core/services/auth.service';
import { BillingService } from '../../core/services/billing.service';
import { EntitlementsStore } from '../../core/services/entitlements.store';
import { SharedModule } from '../../shared/shared.module';
import { FeaturePreviewComponent } from './feature-preview.component';

/** The platform's prices, as the Credit cap page reads them. */
const WALLET: WalletSummary = {
  balance: 50,
  planCode: 'basic',
  planName: 'Basic',
  monthlyCredits: 100,
  monthStartUtc: '2026-11-01T00:00:00',
  features: PLATFORM_FEATURES.map((feature) => ({
    feature,
    label: feature,
    description: '',
    includedInPlan: feature === 'WhatsAppMessaging',
    spentThisMonth: 0,
    monthlyCap: null,
    costs:
      feature === 'LeadDiscovery'
        ? [
            { scenario: 7, title: 'Find leads', unitLabel: 'candidate', credits: 2, perAction: false },
            { scenario: 8, title: 'Review', unitLabel: 'step', credits: 0, perAction: false },
          ]
        : [{ scenario: 1, title: 'Act', unitLabel: 'action', credits: 1, perAction: false }],
  })),
};

describe('FeaturePreviewComponent', () => {
  let fixture: ComponentFixture<FeaturePreviewComponent>;
  let billing: { getWallet: jasmine.Spy };
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  interface Setup {
    role?: string;
    plan?: PlatformFeature[] | null;
    walletFails?: boolean;
  }

  function render(slug: string, { role = 'Admin', plan = ['WhatsAppMessaging'], walletFails = false }: Setup = {}): HTMLElement {
    billing = { getWallet: jasmine.createSpy('getWallet').and.returnValue(walletFails ? throwError(() => new Error('403')) : of(WALLET)) };
    params = new BehaviorSubject(convertToParamMap({ feature: slug }));
    const auth = { hasAnyRole: (wanted: string[]) => wanted.length === 0 || wanted.includes(role) };

    TestBed.configureTestingModule({
      declarations: [FeaturePreviewComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: BillingService, useValue: billing },
        { provide: ActivatedRoute, useValue: { paramMap: params } },
      ],
    });
    if (plan) {
      TestBed.inject(EntitlementsStore).set({ planCode: 'basic', planName: 'Basic', features: plan, balance: 50, costs: [] });
    }
    fixture = TestBed.createComponent(FeaturePreviewComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (root: HTMLElement, id: string) => (root.querySelector(`[data-testid="${id}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  PLATFORM_FEATURES.forEach((feature) => {
    it(`renders the ${feature} preview from its config: title, outcome, 3 benefits and 3 image slots`, () => {
      const p = FEATURE_PREVIEWS[feature];
      const root = render(p.slug, { plan: [] });

      expect(root.querySelector('h1')?.textContent?.trim()).toBe(p.title);
      expect(text(root, 'preview-outcome')).toBe(p.outcome);
      expect(Array.from(root.querySelectorAll('[data-testid="preview-benefits"] li')).map((li) => li.textContent?.replace('check_circle', '').trim())).toEqual(
        p.benefits
      );
      const images = Array.from(root.querySelectorAll('[data-testid="preview-image"]'));
      expect(images.length).toBe(3);
      expect(images.map((i) => i.querySelector('figcaption')?.textContent?.trim())).toEqual(p.images.map((i) => i.caption));
      expect(root.querySelector('.premium-chip')?.textContent).toContain('Premium');
    });
  });

  it('gives every feature its own slug, benefits and image slots', () => {
    const slugs = PLATFORM_FEATURES.map((f) => FEATURE_PREVIEWS[f].slug);
    expect(new Set(slugs).size).toBe(5);
    PLATFORM_FEATURES.forEach((f) => {
      expect(FEATURE_PREVIEWS[f].feature).toBe(f);
      expect(FEATURE_PREVIEWS[f].benefits.length).toBe(3);
      expect(FEATURE_PREVIEWS[f].images.length).toBe(3);
    });
  });

  describe('for an Admin', () => {
    it('links "Upgrade to Premium" to the plans page and shows no ask-your-admin line', () => {
      const root = render('lead-discovery');

      const upgrade = root.querySelector('[data-testid="preview-upgrade"]') as HTMLAnchorElement;
      expect(upgrade.textContent).toContain('Upgrade to Premium');
      expect(upgrade.getAttribute('href')).toBe('/billing');
      expect(upgrade.getAttribute('target')).toBeNull();
      expect(root.querySelector('[data-testid="preview-ask-admin"]')).toBeNull();
    });

    it("names the real credit costs from the platform's prices", () => {
      const root = render('lead-discovery');

      expect(billing.getWallet).toHaveBeenCalledTimes(1);
      expect(text(root, 'preview-credits')).toContain('Uses 2 credits per candidate · no credits per step, from your one credit balance.');
    });

    it('names no number when the prices cannot be read', () => {
      const root = render('lead-discovery', { walletFails: true });

      expect(text(root, 'preview-credits')).toContain('Uses credits from your balance. The Credit cap page lists every price.');
      expect(text(root, 'preview-credits')).not.toMatch(/\d/);
    });
  });

  describe('for a user who is not an Admin', () => {
    ['SalesManager', 'SalesAgent'].forEach((role) => {
      it(`tells a ${role} to ask their admin, with no button and no request`, () => {
        const root = render('content-studio', { role });

        expect(root.querySelector('[data-testid="preview-ask-admin"] span')?.textContent?.trim()).toBe('Ask your admin to upgrade to Premium. Only an admin can change the plan.');
        expect(root.querySelector('[data-testid="preview-upgrade"]')).toBeNull();
        expect(root.querySelector('[data-testid="preview-actions"] a, [data-testid="preview-actions"] button')).toBeNull();
        expect(billing.getWallet).not.toHaveBeenCalled();
        expect(text(root, 'preview-credits')).not.toMatch(/\d/);
      });
    });
  });

  it('offers to open the screen instead once the plan includes the feature', () => {
    const root = render('whatsapp-messaging');

    expect(root.querySelector('.premium-chip')).toBeNull();
    expect(root.querySelector('[data-testid="preview-upgrade"]')).toBeNull();
    expect((root.querySelector('[data-testid="preview-open"]') as HTMLAnchorElement).getAttribute('href')).toBe('/campaigns');
  });

  it('sends an unknown feature to the dashboard', () => {
    render('lead-discovery');
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.returnValue(Promise.resolve(true));

    params.next(convertToParamMap({ feature: 'nope' }));

    expect(navigate).toHaveBeenCalledWith('/dashboard');
  });
});
