import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { NotificationService } from '../../../core/services/notification.service';

export interface SocialAdsGuideDialogData {
  /** Shown to copy into the Meta App: it must match what the connect button sends, character for character. */
  redirectUri: string;
  /** Opens on the Meta app setup tab instead of the tenant's connect steps. */
  startOnSetup: boolean;
}

/** The step-by-step help for connecting Facebook & Instagram, in a modal so the page itself stays uncluttered. */
@Component({
  selector: 'app-social-ads-guide-dialog',
  templateUrl: './social-ads-guide-dialog.component.html',
  styleUrls: ['./social-ads-guide-dialog.component.scss'],
})
export class SocialAdsGuideDialogComponent {
  readonly metaAppsUrl = 'https://developers.facebook.com/apps/';

  constructor(
    @Inject(MAT_DIALOG_DATA) public readonly data: SocialAdsGuideDialogData,
    private readonly notify: NotificationService
  ) {}

  /** Copies the redirect address; falls back to a message when the browser blocks clipboard access. */
  copyRedirectUri(): void {
    const clipboard = navigator.clipboard;
    if (!clipboard) {
      this.notify.error('Copy is not available here. Select the address and copy it by hand.');
      return;
    }
    clipboard.writeText(this.data.redirectUri).then(
      () => this.notify.success('Redirect address copied.'),
      () => this.notify.error('Could not copy. Select the address and copy it by hand.')
    );
  }
}
