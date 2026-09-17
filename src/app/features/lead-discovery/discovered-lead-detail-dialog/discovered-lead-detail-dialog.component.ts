import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { DiscoveredLead, leadScoreChipClass } from '../../../core/models/lead-discovery.model';

/** Everything the API returns about one discovered lead, including where each detail was found. */
@Component({
  selector: 'app-discovered-lead-detail-dialog',
  templateUrl: './discovered-lead-detail-dialog.component.html',
  styleUrls: ['./discovered-lead-detail-dialog.component.scss'],
})
export class DiscoveredLeadDetailDialogComponent {
  readonly scoreClass = leadScoreChipClass;

  constructor(@Inject(MAT_DIALOG_DATA) public readonly lead: DiscoveredLead) {}

  get location(): string {
    return [this.lead.address, this.lead.city, this.lead.state].filter(Boolean).join(', ');
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

  /** Only http(s) links are rendered as links — the values come from the open web. */
  isSafeLink(url: string | null): boolean {
    return !!url && /^https?:\/\//i.test(url);
  }
}
