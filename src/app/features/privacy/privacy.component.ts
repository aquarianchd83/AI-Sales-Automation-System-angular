import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Static privacy policy page. Reachable without signing in; makes no network requests. */
@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.component.html',
  styleUrls: ['./privacy.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyComponent {
  readonly productName = 'Sellio';
  /** TODO: replace with the real privacy contact before publishing. */
  readonly contactEmail = 'privacy@nayancare.com';
  readonly lastUpdated = '17 November 2026';
}
