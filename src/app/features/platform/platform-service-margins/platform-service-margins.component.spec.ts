import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { CreditScenario } from '../../../core/models/credit-payer.model';
import { ServiceMarginPack, ServiceMarginRow, ServiceMargins, previewRow } from '../../../core/models/service-margin.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformServiceMarginService } from '../../../core/services/platform-service-margin.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformServiceMarginsComponent } from './platform-service-margins.component';

// A small pack at Rs 2 a credit and a big one at Rs 1 a credit.
const packs: ServiceMarginPack[] = [
  { id: 'small', name: '100 credits', credits: 100, priceInr: 200, inrPerCredit: 2 },
  { id: 'big', name: '500 credits', credits: 500, priceInr: 500, inrPerCredit: 1 },
];

const row = (scenario: CreditScenario, title: string, unit: string, costInr: number | null, creditsPerUnit: number, unitsPerItem = 1): ServiceMarginRow =>
  previewRow(
    {
      scenario,
      title,
      unitLabel: unit,
      costUsd: costInr === null ? null : costInr / 100,
      costInr,
      costBasis: costInr === null ? 'Not tracked: the platform does not record what Content Studio steps cost it' : 'Average of 12 AI replies in the last 30 days',
      samples: 12,
      costEditable: scenario === CreditScenario.ContentStudioGeneration || scenario === CreditScenario.ContentStudioVideoRender,
      costIsManual: false,
      creditsPerUnit,
      unitsPerItem,
      creditsCharged: 0,
      paidByPlatform: false,
      byPack: [],
    },
    packs,
    creditsPerUnit * unitsPerItem
  );

const margins = (): ServiceMargins => ({
  inrPerUsd: 100,
  notes: [],
  packs,
  rows: [
    row(CreditScenario.CustomerChatReply, 'AI conversation', 'reply', 0.5, 1),
    row(CreditScenario.LeadDiscovery, 'Discover customers', 'candidate', 1.5, 1),
    row(CreditScenario.WhatsAppTemplateSend, 'WhatsApp message', 'marketing message', 0.4, 2),
    row(CreditScenario.ContentStudioGeneration, 'Content Studio generation', 'step', null, 1),
    row(CreditScenario.ContentStudioVideoRender, 'Content Studio video render', 'video', null, 10),
    row(CreditScenario.ProductKnowledgeReading, 'Product knowledge: reading sources', 'action', 4, 5),
    row(CreditScenario.ProductKnowledgeAnswering, 'Product knowledge: drafting and answering', 'action', 0.5, 1),
  ],
});

describe('PlatformServiceMarginsComponent', () => {
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(service: Partial<Record<'get' | 'update', jasmine.Spy>> = {}) {
    const api = {
      get: service.get ?? jasmine.createSpy('get').and.returnValue(of(margins())),
      update: service.update ?? jasmine.createSpy('update').and.returnValue(of(margins())),
    };
    const notify = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error') };
    TestBed.configureTestingModule({
      declarations: [PlatformServiceMarginsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PlatformServiceMarginService, useValue: api },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const fixture = TestBed.createComponent(PlatformServiceMarginsComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const rows = () => Array.from(root.querySelectorAll('tr.mat-mdc-row'));
    const packCells = (r: Element) => Array.from(r.querySelectorAll('td.pack-cell'));
    const type = (input: HTMLInputElement, value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    return { fixture, root, api, notify, rows, packCells, type };
  }

  it('lists every service credits are spent on, with a margin column for each credit pack', () => {
    const { rows, root, packCells } = render();

    expect(rows().length).toBe(6);
    expect(text(rows()[0])).toContain('AI conversation');
    expect(text(rows()[1])).toContain('Discover customers');
    expect(text(rows()[2])).toContain('WhatsApp message');
    expect(text(rows()[3])).toContain('Content Studio video render');
    expect(text(rows()[4])).toContain('Product knowledge: reading sources');
    expect(text(rows()[5])).toContain('Product knowledge: drafting and answering');
    expect(root.textContent).not.toContain('Content Studio generation');
    expect(text(rows()[0].querySelector('[data-testid=cost]'))).toBe('₹ 0.50');

    const heads = Array.from(root.querySelectorAll('th.pack-head')).map((h) => text(h));
    expect(heads).toEqual(['100 credits₹ 2.00 a credit', '500 credits₹ 1.00 a credit']);
    expect(packCells(rows()[0]).length).toBe(2);
  });

  it('gives each pack its own charge and margin', () => {
    const { rows, packCells } = render();

    const [small, big] = packCells(rows()[0]);
    expect(text(small.querySelector('[data-testid=charge]'))).toBe('Charge ₹ 2.00');
    expect(text(small.querySelector('[data-testid=margin-percent]'))).toBe('75%');
    expect(text(big.querySelector('[data-testid=charge]'))).toBe('Charge ₹ 1.00');
    expect(text(big.querySelector('[data-testid=margin-percent]'))).toBe('50%');
  });

  it('offers a box for the cost of a Content Studio video, and nowhere else', () => {
    const { rows } = render();

    expect(rows()[3].querySelector('[data-testid=cost-input]')).not.toBeNull();
    [0, 1, 2, 4, 5].forEach((i) => expect(rows()[i].querySelector('[data-testid=cost-input]')).toBeNull());
  });

  it('works out the margin of Content Studio as the cost is typed, without saving', () => {
    const { rows, packCells, type, api, fixture } = render();

    // A video render draws 10 credits: Rs 20 on the small pack, Rs 10 on the big one, against a typed Rs 8.
    type(rows()[3].querySelector('[data-testid=cost-input]') as HTMLInputElement, '8');

    const [small, big] = packCells(rows()[3]);
    expect(text(small.querySelector('[data-testid=margin-percent]'))).toBe('60%');
    expect(text(small.querySelector('[data-testid=margin-inr]'))).toBe('Margin ₹ 12.00');
    expect(text(big.querySelector('[data-testid=margin-percent]'))).toBe('20%');
    expect(api.update).not.toHaveBeenCalled();
    expect(fixture.componentInstance.dirty).toBeTrue();

    // A cost above the charge is a loss on the pack it exceeds.
    type(rows()[3].querySelector('[data-testid=cost-input]') as HTMLInputElement, '15');
    expect(text(big.querySelector('[data-testid=margin-inr]'))).toBe('Loss ₹ 5.00');
    expect(text(rows()[3].querySelector('[data-testid=loss]'))).toContain('500 credits');
  });

  it('saves the typed cost, and clears one that was emptied', () => {
    const { root, rows, type, api, fixture } = render();

    type(rows()[3].querySelector('[data-testid=cost-input]') as HTMLInputElement, '8');
    (root.querySelector('[data-testid=save]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.update.calls.mostRecent().args[0].manualCosts).toEqual([
      { scenario: CreditScenario.ContentStudioGeneration, costInr: null },
      { scenario: CreditScenario.ContentStudioVideoRender, costInr: 8 },
    ]);
  });

  it('shows the charge of a service whose cost is not tracked, with no margin', () => {
    const { rows, packCells } = render();

    const video = rows()[3];
    expect(text(video)).toContain('Not tracked');
    const [small, big] = packCells(video);
    expect(text(small.querySelector('[data-testid=charge]'))).toBe('Charge ₹ 20.00');
    expect(text(big.querySelector('[data-testid=charge]'))).toBe('Charge ₹ 10.00');
    expect(text(small.querySelector('[data-testid=margin-percent]'))).toBe('-');
    expect(small.querySelector('[data-testid=margin-inr]')).toBeNull();
    expect(video.querySelector('[data-testid=loss]')).toBeNull();
  });

  it('works out the margin of a product knowledge action per pack', () => {
    const { rows, packCells } = render();

    // Reading draws 5 credits: Rs 10 on the small pack against a Rs 4 cost, Rs 5 on the big one.
    const [small, big] = packCells(rows()[4]);
    expect(text(small.querySelector('[data-testid=margin-percent]'))).toBe('60%');
    expect(text(big.querySelector('[data-testid=margin-percent]'))).toBe('20%');
  });

  it('shows where the cost came from, and that it is not typed', () => {
    const { rows, root } = render();

    expect(text(rows()[0])).toContain('Average of 12 AI replies in the last 30 days');
    expect(rows()[0].querySelector('[data-testid=cost] input')).toBeNull();
    expect(text(root)).toContain('you do not type it');
  });

  it('shows a loss, and names the pack it happens on', () => {
    const { rows, packCells } = render();

    // Discovery costs Rs 1.50: a profit at Rs 2 a credit, a loss at Rs 1.
    const [small, big] = packCells(rows()[1]);
    expect(small.querySelector('[data-testid=margin-percent]')?.classList).not.toContain('loss');
    expect(big.querySelector('[data-testid=margin-percent]')?.classList).toContain('loss');
    expect(text(big.querySelector('[data-testid=margin-percent]'))).toBe('-50%');
    expect(text(big.querySelector('[data-testid=margin-inr]'))).toBe('Loss ₹ 0.50');
    expect(text(rows()[1].querySelector('[data-testid=loss]'))).toBe('We lose money on every candidate bought in 500 credits.');
    expect(rows()[0].querySelector('[data-testid=loss]')).toBeNull();
  });

  it('shows WhatsApp as a marketing message with the same credits tenants see, and charges exactly that', () => {
    const { rows, packCells, type, root, api, fixture } = render();

    // The box holds the setting itself - 2 credits - so what a tenant is shown ("2 credits per message") is what is charged: Rs 4.00 on the small pack.
    const input = rows()[2].querySelector('input') as HTMLInputElement;
    expect(text(rows()[2])).toContain('per marketing message');
    expect(input.value).toBe('2');
    expect(text(packCells(rows()[2])[0].querySelector('[data-testid=charge]'))).toBe('Charge ₹ 4.00');
    expect(text(packCells(rows()[2])[1].querySelector('[data-testid=charge]'))).toBe('Charge ₹ 2.00');
    expect(rows()[2].querySelector('[data-testid=mix]')).toBeNull();

    type(input, '3');
    (root.querySelector('[data-testid=save]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.update.calls.mostRecent().args[0].charges[2]).toEqual({ scenario: CreditScenario.WhatsAppTemplateSend, creditsPerUnit: 3 });
  });

  it('recalculates every pack as the credits are typed, without saving', () => {
    const { rows, packCells, type, api, fixture } = render();

    type(rows()[0].querySelector('input') as HTMLInputElement, '3');

    const [small, big] = packCells(rows()[0]);
    expect(text(small.querySelector('[data-testid=charge]'))).toBe('Charge ₹ 6.00');
    expect(text(small.querySelector('[data-testid=margin-percent]'))).toBe('91.7%');
    expect(text(big.querySelector('[data-testid=charge]'))).toBe('Charge ₹ 3.00');
    expect(api.update).not.toHaveBeenCalled();
    expect(fixture.componentInstance.dirty).toBeTrue();
  });

  it('says the changes are not saved until Save charges is pressed, and stops saying so once they are', () => {
    const { root, rows, type, fixture } = render();

    expect(root.querySelector('[data-testid=unsaved]')).toBeNull();

    type(rows()[0].querySelector('input') as HTMLInputElement, '0.5');
    expect(text(root.querySelector('[data-testid=unsaved]'))).toContain('Not saved yet');
    expect(text(root.querySelector('[data-testid=unsaved]'))).toContain('tenants still see the old credit prices');

    (root.querySelector('[data-testid=save]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid=unsaved]')).toBeNull();
  });

  it('saves the credits of every service', () => {
    const { root, rows, type, api, notify, fixture } = render();

    type(rows()[1].querySelector('input') as HTMLInputElement, '2');
    (root.querySelector('[data-testid=save]') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(api.update).toHaveBeenCalledWith({
      charges: [
        { scenario: CreditScenario.CustomerChatReply, creditsPerUnit: 1 },
        { scenario: CreditScenario.LeadDiscovery, creditsPerUnit: 2 },
        { scenario: CreditScenario.WhatsAppTemplateSend, creditsPerUnit: 2 },
        { scenario: CreditScenario.ContentStudioGeneration, creditsPerUnit: 1 },
        { scenario: CreditScenario.ContentStudioVideoRender, creditsPerUnit: 10 },
        { scenario: CreditScenario.ProductKnowledgeReading, creditsPerUnit: 5 },
        { scenario: CreditScenario.ProductKnowledgeAnswering, creditsPerUnit: 1 },
      ],
      manualCosts: [
        { scenario: CreditScenario.ContentStudioGeneration, costInr: null },
        { scenario: CreditScenario.ContentStudioVideoRender, costInr: null },
      ],
    });
    expect(notify.success).toHaveBeenCalled();
    expect(fixture.componentInstance.dirty).toBeFalse();
  });

  it('will not save a negative number of credits', () => {
    const { root, rows, type, api } = render();

    type(rows()[0].querySelector('input') as HTMLInputElement, '-1');

    expect((root.querySelector('[data-testid=save]') as HTMLButtonElement).disabled).toBeTrue();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('discards what was typed', () => {
    const { rows, packCells, type, fixture } = render();

    type(rows()[0].querySelector('input') as HTMLInputElement, '9');
    fixture.componentInstance.discard();
    fixture.detectChanges();

    expect(text(packCells(rows()[0])[0].querySelector('[data-testid=charge]'))).toBe('Charge ₹ 2.00');
    expect(fixture.componentInstance.dirty).toBeFalse();
  });

  it('says so when there is no pack to measure against', () => {
    const data = { ...margins(), packs: [], notes: ['No active credit pack has an India price, so there is no pack to measure the charge against.'] };
    data.rows = data.rows.map((r) => previewRow(r, [], r.creditsCharged));
    const { root, rows, packCells } = render({ get: jasmine.createSpy('get').and.returnValue(of(data)) });

    expect(text(root.querySelector('[data-testid=notes]'))).toContain('No active credit pack has an India price');
    expect(packCells(rows()[0]).length).toBe(0);
  });

  it('says so when the margins could not be loaded', () => {
    const { root } = render({ get: jasmine.createSpy('get').and.returnValue(throwError(() => new Error('down'))) });

    expect(text(root.querySelector('[data-testid=failed]'))).toContain('could not be loaded');
  });

  it('marks a service the platform pays for', () => {
    const data = margins();
    data.rows[1] = { ...data.rows[1], paidByPlatform: true };
    const { rows } = render({ get: jasmine.createSpy('get').and.returnValue(of(data)) });

    expect(text(rows()[1])).toContain('The platform pays for this one');
  });
});
