import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Static data deletion instructions page (the "Data deletion instructions URL" in the Meta app settings).
 * Reachable without signing in; makes no network requests. Shares the privacy page's styles.
 */
@Component({
  selector: 'app-data-deletion',
  templateUrl: './data-deletion.component.html',
  styleUrls: ['../privacy/privacy.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataDeletionComponent {
  readonly productName = 'AiSaarthi';
  readonly contactEmail = 'support@aisaarthi.in';
  readonly lastUpdated = '26 November 2026';
  readonly mailSubject = encodeURIComponent('Data deletion request');
}
