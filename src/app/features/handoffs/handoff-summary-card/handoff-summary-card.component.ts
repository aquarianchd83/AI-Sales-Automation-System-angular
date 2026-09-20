import { Component, Input } from '@angular/core';

import { HandoffSummary, handoffTriggerReasonLabel, leadTemperatureChipClass } from '../../../core/models/handoff.model';

/**
 * The briefing an agent reads before picking a conversation up.
 *
 * Purely presentational — it renders the snapshot the server stored when the handoff was raised and
 * fetches nothing of its own. That is deliberate: the lead keeps changing after an escalation, and a
 * card that refreshed itself would describe a different situation than the one that caused it.
 *
 * Kept as its own component rather than inlined in the dialog so the handoff detail screen can reuse
 * it unchanged when it arrives.
 */
@Component({
  selector: 'app-handoff-summary-card',
  templateUrl: './handoff-summary-card.component.html',
  styleUrls: ['./handoff-summary-card.component.scss'],
})
export class HandoffSummaryCardComponent {
  @Input() summary!: HandoffSummary;

  readonly temperatureClass = leadTemperatureChipClass;
  readonly reasonLabel = handoffTriggerReasonLabel;

  /** Rules add points, and nothing in the scoring model subtracts them except a configured penalty —
   * so a negative line is worth showing as one rather than as "+-20". */
  signed(points: number): string {
    return points >= 0 ? `+${points}` : `${points}`;
  }
}
