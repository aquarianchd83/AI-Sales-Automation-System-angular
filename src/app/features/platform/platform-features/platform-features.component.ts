import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { PlatformFeatureSwitchService } from '../../../core/services/platform-feature-switch.service';
import { PLATFORM_FEATURE_ICONS, PlatformFeature, PlatformFeatureSwitch } from '../../../core/models/wallet.model';

/**
 * The Platform Admin Console's Features page: publish or unpublish each feature for the whole platform. An unpublished feature disappears from every
 * tenant's menu and is refused by the API, whatever the tenant's plan includes. Each switch saves on its own and applies from the next request.
 */
@Component({
  selector: 'app-platform-features',
  templateUrl: './platform-features.component.html',
  styleUrls: ['./platform-features.component.scss'],
})
export class PlatformFeaturesComponent implements OnInit {
  features: PlatformFeatureSwitch[] = [];
  loading = true;
  loadFailed = false;
  /** The feature whose switch is being saved: its toggle is disabled meanwhile. */
  saving: PlatformFeature | null = null;

  readonly icons = PLATFORM_FEATURE_ICONS;

  constructor(
    private readonly switches: PlatformFeatureSwitchService,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get unpublishedCount(): number {
    return this.features.filter((f) => !f.published).length;
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.switches
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (features) => (this.features = features),
        error: () => (this.loadFailed = true),
      });
  }

  toggle(item: PlatformFeatureSwitch, published: boolean): void {
    this.saving = item.feature;
    this.switches
      .setPublished(item.feature, published)
      .pipe(finalize(() => (this.saving = null)))
      .subscribe({
        next: (updated) => {
          this.features = this.features.map((f) => (f.feature === updated.feature ? updated : f));
          this.notify.success(`${updated.label} ${updated.published ? 'published' : 'unpublished'} for all tenants.`);
        },
        // The toggle already moved on screen: put the list back to what the server still holds.
        error: () => {
          this.features = [...this.features];
          this.notify.error(`Could not ${published ? 'publish' : 'unpublish'} ${item.label}. Nothing was changed.`);
        },
      });
  }
}
