import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { LeadDiscoveryCandidateDetails, LeadDiscoveryExecutionCustomer } from '../../../core/models/lead-discovery-history.model';
import { SharedModule } from '../../../shared/shared.module';
import { CandidatesConsideredDialogComponent, CandidatesConsideredDialogData } from './candidates-considered-dialog.component';

const row = (over: Partial<LeadDiscoveryExecutionCustomer>): LeadDiscoveryExecutionCustomer => ({
  id: 'r',
  customerId: null,
  discoveredLeadId: null,
  customerName: 'Business',
  phone: '+919800000001',
  status: 'Created',
  isInvalid: false,
  errorMessage: null,
  errorDetails: null,
  retriedFromId: null,
  processedAtUtc: null,
  verificationStatus: 'NotChecked',
  verificationReasonCode: null,
  verificationReason: null,
  verifiedAtUtc: null,
  ...over,
});

const details = (over: Partial<LeadDiscoveryCandidateDetails> = {}): LeadDiscoveryCandidateDetails => ({
  businessType: 'Dental clinic',
  contactPerson: 'Dr. Nakul Singla',
  address: 'SCO 12, Sector 20',
  city: 'Chandigarh',
  state: 'Punjab',
  phone: '+91 87280 70880',
  phoneSourceUrl: 'https://pristine.example/contact',
  email: 'hello@pristine.example',
  website: 'https://pristine.example',
  sourceUrl: 'https://pristine.example/contact',
  isIndependentBusiness: true,
  isPermanentlyClosed: false,
  leadScore: 82,
  scoreRationale: 'Strong match.',
  ...over,
});

const NOT_NEEDED = 'Qualified, but the batch was already full - not saved and not charged.';

describe('CandidatesConsideredDialogComponent', () => {
  let fixture: ComponentFixture<CandidatesConsideredDialogComponent>;

  const el = () => fixture.nativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const bodyRows = () => el().querySelectorAll('tr.candidate-row').length;
  const chips = () => Array.from(el().querySelectorAll<HTMLButtonElement>('.chip-button'));
  /** "Saved 2": the outcome label and its count - separate elements, spaced by CSS rather than by text. */
  const chipTexts = () => chips().map((c) => `${c.querySelector('.status-chip')?.textContent?.trim()} ${c.querySelector('strong')?.textContent?.trim()}`);

  function create(data: CandidatesConsideredDialogData): void {
    TestBed.configureTestingModule({
      declarations: [CandidatesConsideredDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [{ provide: MAT_DIALOG_DATA, useValue: data }],
    });
    fixture = TestBed.createComponent(CandidatesConsideredDialogComponent);
    fixture.detectChanges();
  }

  const sixCandidates = (): LeadDiscoveryExecutionCustomer[] => [
    row({ id: '1', customerName: 'Pristine Dental', status: 'Created', outcome: 'Saved' }),
    row({ id: '2', customerName: 'ADC Dentistry', status: 'Created', outcome: 'Saved' }),
    row({ id: '3', customerName: 'Clove Dental', status: 'Skipped', errorMessage: NOT_NEEDED, outcome: 'Not needed' }),
    row({ id: '4', customerName: 'Dr Agarwal', status: 'Skipped', errorMessage: NOT_NEEDED, outcome: 'Not needed' }),
    row({ id: '5', customerName: 'Closed Clinic', status: 'Skipped', isInvalid: true, errorMessage: 'Invalid: closed business (not charged)', outcome: 'Rejected' }),
    row({ id: '6', customerName: 'Existing Clinic', status: 'Duplicate', errorMessage: 'Matches an existing customer or discovered lead (not charged).', outcome: 'Duplicate' }),
  ];

  it('lists every candidate the run considered, with its outcome and why', () => {
    create({ considered: 6, rows: sixCandidates() });

    expect(text()).toContain('Candidates considered (6)');
    expect(bodyRows()).toBe(6);
    for (const name of ['Pristine Dental', 'ADC Dentistry', 'Clove Dental', 'Dr Agarwal', 'Closed Clinic', 'Existing Clinic']) {
      expect(text()).toContain(name);
    }
    expect(text()).toContain('batch was already full');
    expect(text()).toContain('closed business (not charged)');
    expect(text()).toContain('Saved as a customer.');
  });

  it('summarises how many ended in each outcome, only for the outcomes that occur', () => {
    create({ considered: 6, rows: sixCandidates() });

    expect(chipTexts()).toEqual(['Saved 2', 'Duplicate 1', 'Rejected 1', 'Not needed 2']);
  });

  it('narrows the list to one outcome when its chip is pressed, and back to all when pressed again', () => {
    create({ considered: 6, rows: sixCandidates() });

    chips()[3].click(); // Not needed
    fixture.detectChanges();
    expect(bodyRows()).toBe(2);
    expect(text()).toContain('Clove Dental');
    expect(text()).not.toContain('Pristine Dental');

    chips()[3].click();
    fixture.detectChanges();
    expect(bodyRows()).toBe(6);
  });

  describe('opened from a figure on the execution page', () => {
    /** 6 saved (4 customers + 2 kept only as leads), 2 duplicate, 2 rejected - 10 considered. */
    const tenCandidates = (): LeadDiscoveryExecutionCustomer[] => [
      ...[1, 2, 3, 4].map((n) => row({ id: `s${n}`, customerName: `Saved ${n}`, status: 'Created', outcome: 'Saved' })),
      ...[1, 2].map((n) => row({ id: `l${n}`, customerName: `Lead only ${n}`, status: 'Skipped', isInvalid: true, discoveredLeadId: 'lead', outcome: 'Lead only' })),
      ...[1, 2].map((n) => row({ id: `d${n}`, customerName: `Duplicate ${n}`, status: 'Duplicate', outcome: 'Duplicate' })),
      ...[1, 2].map((n) => row({ id: `r${n}`, customerName: `Rejected ${n}`, status: 'Skipped', isInvalid: true, outcome: 'Rejected' })),
    ];

    it('lists all 10 when opened from the considered figure', () => {
      create({ considered: 10, rows: tenCandidates(), filter: [] });

      expect(bodyRows()).toBe(10);
      expect(chipTexts()).toEqual(['Saved 4', 'Lead only 2', 'Duplicate 2', 'Rejected 2']);
    });

    it('lists the 6 saved when opened from the saved figure, with both of its outcomes pressed', () => {
      create({ considered: 10, rows: tenCandidates(), filter: ['Saved', 'Lead only'] });

      expect(bodyRows()).toBe(6);
      expect(text()).toContain('Lead only 1');
      expect(text()).not.toContain('Duplicate 1');
      expect(text()).not.toContain('Rejected 1');
      expect(chips().map((c) => c.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'false', 'false']);
    });

    it('lists the 2 duplicates when opened from the duplicate figure', () => {
      create({ considered: 10, rows: tenCandidates(), filter: ['Duplicate'] });

      expect(bodyRows()).toBe(2);
      expect(text()).toContain('Duplicate 1');
      expect(text()).toContain('Duplicate 2');
    });

    it('lists the 2 rejected when opened from the rejected figure', () => {
      create({ considered: 10, rows: tenCandidates(), filter: ['Rejected'] });

      expect(bodyRows()).toBe(2);
      expect(text()).toContain('Rejected 1');
    });

    it('can be widened from there: pressing another outcome adds it, pressing a pressed one takes it off', () => {
      create({ considered: 10, rows: tenCandidates(), filter: ['Duplicate'] });

      chips()[3].click(); // Rejected
      fixture.detectChanges();
      expect(bodyRows()).toBe(4);

      chips()[2].click(); // Duplicate off
      fixture.detectChanges();
      expect(bodyRows()).toBe(2);

      chips()[3].click(); // Rejected off - nothing pressed shows everything
      fixture.detectChanges();
      expect(bodyRows()).toBe(10);
    });

    it('shows a lead kept without a customer as "Lead only", not as rejected, even from a response that predates the outcome field', () => {
      create({
        considered: 1,
        rows: [row({ id: '1', customerName: 'Kept', status: 'Skipped', isInvalid: true, discoveredLeadId: 'lead', outcome: undefined })],
      });

      expect(chipTexts()).toEqual(['Lead only 1']);
    });
  });

  it('says so when the run counted more candidates than were recorded one by one', () => {
    create({ considered: 8, rows: sixCandidates() });

    expect(text()).toContain('2 more candidates were counted for this run but not recorded one by one');
  });

  it('does not say that when every candidate is recorded', () => {
    create({ considered: 6, rows: sixCandidates() });

    expect(text()).not.toContain('not recorded one by one');
  });

  it('works out the outcome itself for a response that predates the outcome field', () => {
    create({
      considered: 3,
      rows: [
        row({ id: '1', customerName: 'A', status: 'Created' }),
        row({ id: '2', customerName: 'B', status: 'Skipped', isInvalid: true }),
        row({ id: '3', customerName: 'C', status: 'Duplicate' }),
      ],
    });

    expect(chipTexts()).toEqual(['Saved 1', 'Duplicate 1', 'Rejected 1']);
  });

  it('explains an execution with no recorded candidates instead of showing an empty table', () => {
    create({ considered: 0, rows: [] });

    expect(text()).toContain('No individual candidates were recorded for this execution.');
    expect(el().querySelector('table')).toBeNull();
  });

  describe('details of a candidate', () => {
    const toggles = () => Array.from(el().querySelectorAll<HTMLButtonElement>('.expand-button'));
    const panel = () => el().querySelector<HTMLElement>('[data-test="candidate-details"]');

    const withDetails = (): LeadDiscoveryExecutionCustomer[] => [
      row({ id: '1', customerName: 'Pristine Dental', status: 'Created', outcome: 'Saved', candidate: details() }),
      row({
        id: '2',
        customerName: 'Closed Clinic',
        status: 'Skipped',
        isInvalid: true,
        errorMessage: 'Invalid: closed business (not charged)',
        outcome: 'Rejected',
        candidate: details({ contactPerson: null, phone: null, phoneSourceUrl: null, isPermanentlyClosed: true, leadScore: 40, scoreRationale: 'Appears closed.' }),
      }),
    ];

    it('shows the location, business type and score of every candidate in the list, including one that was rejected', () => {
      create({ considered: 2, rows: withDetails() });

      expect(text()).toContain('Chandigarh, Punjab');
      expect(text()).toContain('Dental clinic');
      expect(text()).toContain('82');
      expect(text()).toContain('40');
    });

    it('opens what the search found about a candidate, and closes it again', () => {
      create({ considered: 2, rows: withDetails() });
      expect(panel()).toBeNull();

      toggles()[0].click();
      fixture.detectChanges();

      expect(panel()?.textContent).toContain('Dr. Nakul Singla');
      expect(panel()?.textContent).toContain('SCO 12, Sector 20');
      expect(panel()?.textContent).toContain('hello@pristine.example');
      expect(panel()?.textContent).toContain('Strong match.');
      expect(toggles()[0].getAttribute('aria-expanded')).toBe('true');

      toggles()[0].click();
      fixture.detectChanges();
      expect(panel()).toBeNull();
    });

    it('opens the details of a rejected candidate too - that is the point of keeping them', () => {
      create({ considered: 2, rows: withDetails() });

      toggles()[1].click();
      fixture.detectChanges();

      expect(panel()?.textContent).toContain('Appears closed.');
      expect(panel()?.textContent).toContain('Permanently closed');
      expect(panel()?.textContent).toContain('Yes');
    });

    it('has only one candidate open at a time', () => {
      create({ considered: 2, rows: withDetails() });

      toggles()[0].click();
      fixture.detectChanges();
      toggles()[1].click();
      fixture.detectChanges();

      expect(el().querySelectorAll('[data-test="candidate-details"]').length).toBe(1);
      expect(panel()?.textContent).toContain('Appears closed.');
    });

    it('opens a candidate when its row is clicked', () => {
      create({ considered: 2, rows: withDetails() });

      el().querySelectorAll<HTMLElement>('tr.candidate-row')[0].click();
      fixture.detectChanges();

      expect(panel()).not.toBeNull();
    });

    it('offers nothing to open on a row that has no details, and says nothing about opening rows when none have any', () => {
      create({ considered: 1, rows: [row({ id: '1', customerName: 'Old Run Business', status: 'Created' })] });

      expect(toggles().length).toBe(0);
      expect(text()).not.toContain('Open a row');
      el().querySelector<HTMLElement>('tr.candidate-row')!.click();
      fixture.detectChanges();
      expect(panel()).toBeNull();
    });

    it('turns a web address into a link only when it is http or https, because the agent wrote it', () => {
      create({
        considered: 1,
        rows: [row({ id: '1', status: 'Created', candidate: details({ website: 'javascript:alert(1)', sourceUrl: 'https://pristine.example/contact' }) })],
      });

      toggles()[0].click();
      fixture.detectChanges();

      const links = Array.from(panel()!.querySelectorAll<HTMLAnchorElement>('a')).map((a) => a.getAttribute('href'));
      expect(links).toContain('https://pristine.example/contact');
      expect(links.some((href) => href?.startsWith('javascript:'))).toBeFalse();
      expect(panel()?.textContent).toContain('javascript:alert(1)'); // still shown, as plain text
    });

    it('says "Not clear" for what the agent could not tell', () => {
      create({ considered: 1, rows: [row({ id: '1', status: 'Created', candidate: details({ isIndependentBusiness: null, isPermanentlyClosed: null }) })] });

      toggles()[0].click();
      fixture.detectChanges();

      expect(panel()?.textContent?.match(/Not clear/g)?.length).toBe(2);
    });
  });
});
