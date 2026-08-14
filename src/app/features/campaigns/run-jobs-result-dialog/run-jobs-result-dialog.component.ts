import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { RunJobsResult, SendRunResult } from '../../../core/models/campaign.model';

export interface RunJobsResultDialogData {
  result: RunJobsResult;
}

interface Row {
  label: string;
  result: SendRunResult;
}

@Component({
  selector: 'app-run-jobs-result-dialog',
  templateUrl: './run-jobs-result-dialog.component.html',
  styleUrls: ['./run-jobs-result-dialog.component.scss'],
})
export class RunJobsResultDialogComponent {
  readonly rows: Row[] = [
    { label: 'Initial sends', result: this.data.result.initialSends },
    { label: 'Follow-ups', result: this.data.result.followUps },
    { label: 'Retries', result: this.data.result.retries },
  ];

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: RunJobsResultDialogData) {}
}
