import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { leadScoreChipClass } from '../../../core/models/lead-discovery.model';
import {
  CANDIDATE_OUTCOMES,
  LeadDiscoveryExecutionCustomer,
  candidateOutcome,
  candidateOutcomeChipClass,
  countCandidateOutcomes,
} from '../../../core/models/lead-discovery-history.model';

export interface CandidatesConsideredDialogData {
  /** The count the run reported ("N considered"), which can be higher than the rows recorded for an older run. */
  considered: number;
  rows: LeadDiscoveryExecutionCustomer[];
  /** The outcomes to open the list narrowed to - what was clicked on the execution page ("6 saved" opens Saved and Lead only). Empty or absent shows every candidate. */
  filter?: string[];
}

/** Every candidate one discovery run considered, with what became of it - so "6 considered · 2 saved" can be opened and the other
 * four accounted for. A row opens to what the agent reported about that candidate (contact, address, website, the page it was found
 * on, its score and why), including the ones that were not saved. Read-only; the rows are the ones the execution page already loaded. */
@Component({
  selector: 'app-candidates-considered-dialog',
  templateUrl: './candidates-considered-dialog.component.html',
  styleUrls: ['./candidates-considered-dialog.component.scss'],
})
export class CandidatesConsideredDialogComponent {
  readonly outcome = candidateOutcome;
  readonly chipClass = candidateOutcomeChipClass;
  readonly scoreClass = leadScoreChipClass;
  readonly hints = CANDIDATE_OUTCOMES;
  readonly columns = ['expand', 'business', 'location', 'phone', 'score', 'outcome', 'note'];
  readonly detailColumns = ['detail'];

  /** The outcomes the list is narrowed to; none selected shows every candidate. */
  readonly selected = new Set<string>(this.data.filter ?? []);

  /** The row whose details are open, if any. */
  expandedId: string | null = null;

  readonly counts = countCandidateOutcomes(this.data.rows);

  constructor(@Inject(MAT_DIALOG_DATA) public readonly data: CandidatesConsideredDialogData) {}

  get shown(): LeadDiscoveryExecutionCustomer[] {
    return this.selected.size === 0 ? this.data.rows : this.data.rows.filter((r) => this.selected.has(candidateOutcome(r)));
  }

  /** Rows the run counted as considered but did not record individually - an execution from before every candidate was recorded. */
  get unrecorded(): number {
    return Math.max(0, this.data.considered - this.data.rows.length);
  }

  /** True when at least one row has details to open - an execution from before candidates were kept has none, and then there is
   * nothing to offer. */
  get anyDetails(): boolean {
    return this.data.rows.some((r) => !!r.candidate);
  }

  hint(outcome: string): string {
    return this.hints.find((h) => h.value === outcome)?.hint ?? '';
  }

  /** Adds the outcome to the list, or takes it off again - several can be open at once. */
  select(outcome: string): void {
    if (!this.selected.delete(outcome)) {
      this.selected.add(outcome);
    }
  }

  isSelected(outcome: string): boolean {
    return this.selected.has(outcome);
  }

  toggle(row: LeadDiscoveryExecutionCustomer): void {
    if (row.candidate) {
      this.expandedId = this.expandedId === row.id ? null : row.id;
    }
  }

  isOpen(row: LeadDiscoveryExecutionCustomer): boolean {
    return !!row.candidate && this.expandedId === row.id;
  }

  /** "Chandigarh, Punjab" - whichever of the two the agent gave. */
  location(row: LeadDiscoveryExecutionCustomer): string {
    return [row.candidate?.city, row.candidate?.state].filter(Boolean).join(', ');
  }

  /** "www.example.com/contact" rather than the full URL, which can be very long. */
  shortUrl(url: string): string {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname === '/' ? '' : parsed.pathname;
      return parsed.host + path;
    } catch {
      return url;
    }
  }

  /** Only http(s) links are rendered as links - these values were written by a model from the open web. */
  isSafeLink(url: string | null | undefined): boolean {
    return !!url && /^https?:\/\//i.test(url);
  }

  /** Yes / No / "Not clear" for a fact the agent may not have been able to tell. */
  yesNo(value: boolean | null | undefined): string {
    return value === true ? 'Yes' : value === false ? 'No' : 'Not clear';
  }
}
