import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { Handoff } from '../../../core/models/handoff.model';

export interface HandoffSummaryDialogData {
  handoff: Handoff;
}

/** Hosts the briefing over the queue rather than on a screen of its own: an agent triaging the list
 * wants to read one and go back, not navigate away and lose their filter and page. */
@Component({
  selector: 'app-handoff-summary-dialog',
  templateUrl: './handoff-summary-dialog.component.html',
})
export class HandoffSummaryDialogComponent {
  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: HandoffSummaryDialogData) {}
}
