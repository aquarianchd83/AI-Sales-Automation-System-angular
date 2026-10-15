import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { finalize } from 'rxjs/operators';

import { CampaignCustomerJourney, CampaignJourneyStep } from '../../../core/models/campaign.model';
import { optInStatusChipClass, optInStatusLabel } from '../../../core/models/customer.model';
import { CampaignService } from '../../../core/services/campaign.service';

export interface CampaignCustomerJourneyDialogData {
  campaignId: string;
  customerId: string;
  /** Shown while the journey loads. */
  displayName: string;
}

/** Colour of a step's chip: green for consent given or a delivery, red for a withdrawal or a failure, blue for something in flight. */
export function journeyStateChipClass(step: Pick<CampaignJourneyStep, 'state'>): string {
  switch (step.state) {
    case 'OptedIn':
    case 'Delivered':
    case 'Read':
    case 'Completed':
      return 'status-chip status-chip--opted-in';
    case 'OptedOut':
    case 'Failed':
      return 'status-chip status-chip--opted-out';
    case 'AwaitingResponse':
    case 'Sent':
    case 'Queued':
    case 'Responded':
    case 'HandedOff':
      return 'status-chip status-chip--running';
    default:
      return 'status-chip status-chip--pending';
  }
}

/**
 * One customer's journey through one campaign, top to bottom, first step first: waiting for consent, got consent, pending,
 * each message, awaiting response, and so on. Consent, campaign status and messages are separate things; each step names which.
 */
@Component({
  selector: 'app-campaign-customer-journey-dialog',
  templateUrl: './campaign-customer-journey-dialog.component.html',
  styleUrls: ['./campaign-customer-journey-dialog.component.scss'],
})
export class CampaignCustomerJourneyDialogComponent implements OnInit {
  readonly chipClass = journeyStateChipClass;
  readonly optInChip = optInStatusChipClass;
  readonly optInText = optInStatusLabel;

  journey: CampaignCustomerJourney | null = null;
  loading = true;
  failed = false;

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: CampaignCustomerJourneyDialogData,
    private readonly campaigns: CampaignService,
    private readonly dialogRef: MatDialogRef<CampaignCustomerJourneyDialogComponent>
  ) {}

  ngOnInit(): void {
    this.campaigns
      .getCustomerJourney(this.data.campaignId, this.data.customerId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (journey) => (this.journey = journey),
        error: () => (this.failed = true),
      });
  }

  close(): void {
    this.dialogRef.close();
  }
}
