import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Static privacy policy page. Reachable without signing in; makes no network requests. */
@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.component.html',
  styleUrls: ['./privacy.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent {
  readonly productName = 'AiSaarthi';
  readonly contactEmail = 'support@aisaarthi.in';
  readonly lastUpdated = '26 November 2026';
}
