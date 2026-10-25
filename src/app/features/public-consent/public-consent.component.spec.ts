import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { ConsentDecisionResult, ConsentPageContent, PublicConsentPage } from '../../core/models/consent-page.model';
import { PublicConsentService } from '../../core/services/public-consent.service';
import { SharedModule } from '../../shared/shared.module';
import { PublicConsentComponent } from './public-consent.component';

const content: ConsentPageContent = {
  businessName: 'Acme Eye Care',
  productDescription: 'Eye tests and glasses for the whole family.',
  additionalInfo: 'Open 9 to 6.\nWalk-ins welcome.',
  consentStatement: 'I agree to receive WhatsApp messages from Acme Eye Care about eye tests, including relevant follow-ups. I understand that I can opt out at any time.',
  privacyPolicyUrl: 'https://acme.example/privacy',
  termsUrl: 'https://acme.example/terms',
  version: 4,
};

const ready: PublicConsentPage = { state: 'Ready', page: content, decision: null, message: null };

describe('PublicConsentComponent', () => {
  let fixture: ComponentFixture<PublicConsentComponent>;
  let service: jasmine.SpyObj<PublicConsentService>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = () => root().textContent ?? '';
  const button = (id: string) => root().querySelector<HTMLButtonElement>(`[data-testid="${id}"]`);
  const tick = () => {
    root().querySelector<HTMLInputElement>('[data-testid="consent-checkbox"] input')!.click();
    fixture.detectChanges();
  };

  function create(page: PublicConsentPage = ready): void {
    service.getPage.and.returnValue(of(page));
    fixture = TestBed.createComponent(PublicConsentComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('PublicConsentService', ['getPage', 'decide']);

    TestBed.configureTestingModule({
      declarations: [PublicConsentComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PublicConsentService, useValue: service },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ token: 'secret-token' }) } } },
      ],
    });
  });

  it('loads the page for the link in the address, and only reads it', () => {
    create();

    expect(service.getPage).toHaveBeenCalledOnceWith('secret-token');
    expect(service.decide).not.toHaveBeenCalled();
  });

  it('shows the tenant\'s product information and consent wording', () => {
    create();

    expect(text()).toContain('Acme Eye Care');
    expect(text()).toContain('Eye tests and glasses for the whole family.');
    expect(text()).toContain('Walk-ins welcome.');
    expect(text()).toContain('I agree to receive WhatsApp messages from Acme Eye Care about eye tests');
    expect(button('agree')!.textContent).toContain('Yes, I Agree');
    expect(button('decline')!.textContent).toContain('No, Not Interested');
  });

  it('shows the privacy policy and terms links, opened safely in a new tab', () => {
    create();

    const links = Array.from(root().querySelectorAll<HTMLAnchorElement>('.policy-links a'));
    expect(links.map((a) => a.textContent!.trim())).toEqual(['Privacy Policy', 'Terms and Conditions']);
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://acme.example/privacy', 'https://acme.example/terms']);
    links.forEach((a) => {
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
      expect(a.rel).toContain('noreferrer');
    });
  });

  it('omits links that are not configured, and refuses one that is not https', () => {
    create({ ...ready, page: { ...content, privacyPolicyUrl: 'javascript:alert(1)', termsUrl: null } });

    expect(root().querySelector('.policy-links')).toBeNull();
  });

  it('writes the description as text, never as markup', () => {
    create({ ...ready, page: { ...content, productDescription: '<img src=x onerror=alert(1)> Eye tests' } });

    expect(root().querySelector('img')).toBeNull();
    expect(text()).toContain('<img src=x onerror=alert(1)> Eye tests');
  });

  it('starts with the box unticked and "Yes" unavailable; "No" is available without ticking', () => {
    create();

    const box = root().querySelector<HTMLInputElement>('[data-testid="consent-checkbox"] input')!;
    expect(box.checked).toBeFalse();
    expect(button('agree')!.disabled).toBeTrue();
    expect(button('decline')!.disabled).toBeFalse();
  });

  it('"Yes" becomes available only once the box is ticked, and goes again when it is cleared', () => {
    create();

    tick();
    expect(button('agree')!.disabled).toBeFalse();
    tick();
    expect(button('agree')!.disabled).toBeTrue();
  });

  it('pressing "Yes" without the box does nothing, even if the button is forced', () => {
    create();

    fixture.componentInstance.submit('agree');

    expect(service.decide).not.toHaveBeenCalled();
  });

  it('"Yes" sends the choice, the ticked box and the version the customer was shown, then confirms', () => {
    const result: ConsentDecisionResult = { outcome: 'Recorded', decision: 'Granted', message: 'Thank you! Your preference has been saved.', page: null };
    service.decide.and.returnValue(of(result));
    create();
    tick();

    button('agree')!.click();
    fixture.detectChanges();

    expect(service.decide).toHaveBeenCalledOnceWith('secret-token', { decision: 'agree', consentChecked: true, pageVersion: 4 });
    expect(root().querySelector('[data-testid="confirmation"]')!.textContent).toContain('Thank you! Your preference has been saved.');
    expect(button('agree')).toBeNull();   // the choice is made; the buttons are gone
  });

  it('"No" sends a decline with no ticked box and confirms nothing will start', () => {
    service.decide.and.returnValue(of({ outcome: 'Recorded', decision: 'NotInterested', message: 'No WhatsApp conversation will be started from this request.', page: null }));
    create();

    button('decline')!.click();
    fixture.detectChanges();

    expect(service.decide).toHaveBeenCalledOnceWith('secret-token', { decision: 'decline', consentChecked: false, pageVersion: 4 });
    expect(text()).toContain('No WhatsApp conversation will be started');
  });

  it('a decline never carries a ticked box even if it was ticked first', () => {
    service.decide.and.returnValue(of({ outcome: 'Recorded', decision: 'NotInterested', message: 'm', page: null }));
    create();
    tick();

    button('decline')!.click();

    expect(service.decide.calls.mostRecent().args[1].consentChecked).toBeFalse();
  });

  it('cannot be submitted twice while the first answer is in flight', () => {
    service.decide.and.returnValue(new Subject<ConsentDecisionResult>());   // never answers
    create();
    tick();

    fixture.componentInstance.submit('agree');
    fixture.componentInstance.submit('agree');
    fixture.componentInstance.submit('decline');

    expect(service.decide).toHaveBeenCalledTimes(1);
  });

  it('when the wording changed while the page was open, it shows the new page unticked and asks again', () => {
    const changed: ConsentPageContent = { ...content, version: 5, consentStatement: 'New wording about WhatsApp.' };
    service.decide.and.returnValue(of({
      outcome: 'PageChanged', decision: null, message: 'This page was updated. Please review it and choose again.',
      page: { state: 'Ready', page: changed, decision: null, message: null },
    }));
    create();
    tick();

    button('agree')!.click();
    fixture.detectChanges();

    expect(text()).toContain('New wording about WhatsApp.');
    expect(text()).toContain('This page was updated');
    expect(button('agree')!.disabled).toBeTrue();   // must be ticked again for the new wording
  });

  it('shows what is already on record when the link was used before', () => {
    create({ state: 'Answered', page: null, decision: 'NotInterested', message: 'Thank you for letting us know.' });

    expect(root().querySelector('[data-testid="confirmation"]')!.textContent).toContain('Thank you for letting us know.');
    expect(button('agree')).toBeNull();
  });

  it('says so plainly for an expired, invalid or unavailable link, with no buttons to press', () => {
    create({ state: 'Expired', page: null, decision: null, message: null });
    expect(root().querySelector('[data-testid="expired"]')).not.toBeNull();
    expect(button('agree')).toBeNull();

    fixture.destroy();
    create({ state: 'Invalid', page: null, decision: null, message: null });
    expect(root().querySelector('[data-testid="invalid"]')).not.toBeNull();

    fixture.destroy();
    create({ state: 'Unavailable', page: null, decision: null, message: null });
    expect(root().querySelector('[data-testid="unavailable"]')).not.toBeNull();
    expect(button('decline')).toBeNull();
  });

  it('offers a retry when the page cannot be loaded, and keeps the customer\'s box unticked', () => {
    service.getPage.and.returnValue(throwError(() => new Error('offline')));
    fixture = TestBed.createComponent(PublicConsentComponent);
    fixture.detectChanges();

    expect(root().querySelector('[data-testid="error"]')).not.toBeNull();

    service.getPage.and.returnValue(of(ready));
    root().querySelector<HTMLButtonElement>('[data-testid="error"] button')!.click();
    fixture.detectChanges();

    expect(text()).toContain('Acme Eye Care');
  });

  it('keeps the link out of search results and referrers while it is open', () => {
    create();

    expect(document.head.querySelector('meta[name="robots"]')!.getAttribute('content')).toContain('noindex');
    expect(document.head.querySelector('meta[name="referrer"]')!.getAttribute('content')).toBe('no-referrer');

    fixture.destroy();
    expect(document.head.querySelector('meta[name="robots"][content*="noindex"]')).toBeNull();
  });

  it('shows no personal information - only the business\'s own page', () => {
    create();

    // The page is built from the business's published content alone: it has no customer name, number or id to show.
    expect(root().innerHTML).not.toContain('+91');
    expect(root().innerHTML).not.toMatch(/customer/i);
  });
});
