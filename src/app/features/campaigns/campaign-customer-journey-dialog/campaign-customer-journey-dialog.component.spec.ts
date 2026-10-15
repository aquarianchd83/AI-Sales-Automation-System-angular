import { NO_ERRORS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import {
  CampaignCustomerJourneyDialogComponent,
  journeyStateChipClass,
} from './campaign-customer-journey-dialog.component';
import { CampaignCustomerJourney } from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { ZonedDatePipe } from '../../../shared/pipes/zoned-date.pipe';

describe('CampaignCustomerJourneyDialogComponent', () => {
  const journey: CampaignCustomerJourney = {
    customerId: 'c1',
    customerName: 'Sim Owner 1',
    phoneNumberE164: '+919800000001',
    optInStatus: 'OptedIn',
    campaignStatus: 'Running',
    steps: [
      {
        key: 'consent-waiting',
        title: 'Waiting for consent',
        dimension: 'Consent',
        state: 'WaitingForConsent',
        occurredAtUtc: '2026-10-15T06:00:00Z',
        summary: 'The customer was added without consent.',
        details: [{ label: 'Added from', value: 'Lead discovery' }],
      },
      {
        key: 'consent-given',
        title: 'Got consent',
        dimension: 'Consent',
        state: 'OptedIn',
        occurredAtUtc: '2026-10-15T06:30:00Z',
        summary: 'Consent recorded.',
        details: [{ label: 'Proof', value: 'wamid.ABC' }],
      },
      {
        key: 'campaign-added',
        title: 'Pending',
        dimension: 'Campaign',
        state: 'Pending',
        occurredAtUtc: '2026-10-15T06:31:00Z',
        summary: 'Added to the campaign.',
        details: [{ label: 'Campaign', value: 'Eye clinic' }],
      },
    ],
  };

  function render(journey$: ReturnType<CampaignService['getCustomerJourney']>) {
    const getCustomerJourney = jasmine.createSpy('getCustomerJourney').and.returnValue(journey$);
    TestBed.configureTestingModule({
      declarations: [CampaignCustomerJourneyDialogComponent, ZonedDatePipe],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { campaignId: 'k1', customerId: 'c1', displayName: 'Sim Owner 1' } },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: CampaignService, useValue: { getCustomerJourney } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(CampaignCustomerJourneyDialogComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    return { getCustomerJourney, root, text: root.textContent ?? '' };
  }

  it('asks for the journey of this customer in this campaign', () => {
    const { getCustomerJourney } = render(of(journey));
    expect(getCustomerJourney).toHaveBeenCalledWith('k1', 'c1');
  });

  it('lists the steps top to bottom in the order given, each with its details', () => {
    const { root, text } = render(of(journey));

    const titles = Array.from(root.querySelectorAll('.timeline li .step-head strong')).map((e) => e.textContent?.trim());
    expect(titles).toEqual(['Waiting for consent', 'Got consent', 'Pending']);
    expect(text).toContain('Lead discovery');
    expect(text).toContain('wamid.ABC');
    expect(text).toContain('Eye clinic');
  });

  it('says which dimension each step moved and where the customer stands now', () => {
    const { text } = render(of(journey));
    expect(text).toContain('Consent');
    expect(text).toContain('Campaign');
    expect(text).toContain('Opted in');
    expect(text).toContain('Running');
  });

  it('shows a failure instead of an empty journey', () => {
    const { root, text } = render(throwError(() => new Error('boom')));
    expect(text).toContain('could not be loaded');
    expect(root.querySelector('.timeline')).toBeNull();
  });

  it('colours consent given and deliveries green, withdrawals and failures red', () => {
    expect(journeyStateChipClass({ state: 'OptedIn' })).toContain('opted-in');
    expect(journeyStateChipClass({ state: 'Delivered' })).toContain('opted-in');
    expect(journeyStateChipClass({ state: 'Failed' })).toContain('opted-out');
    expect(journeyStateChipClass({ state: 'OptedOut' })).toContain('opted-out');
    expect(journeyStateChipClass({ state: 'WaitingForConsent' })).toContain('pending');
  });
});
