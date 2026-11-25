import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Static Terms and Conditions page. Reachable without signing in; makes no network requests. Shares the privacy page's styles. */
@Component({
  selector: 'app-terms',
  templateUrl: './terms.component.html',
  styleUrls: ['../privacy/privacy.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TermsComponent {
  readonly productName = 'AiSaarthi';
  readonly contactEmail = 'support@aisaarthi.in';
  readonly lastUpdated = '25 November 2026';
}
