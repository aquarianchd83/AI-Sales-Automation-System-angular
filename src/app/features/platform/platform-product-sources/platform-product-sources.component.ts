import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { NotificationService } from '../../../core/services/notification.service';
import { SettingsService } from '../../../core/services/settings.service';

const DOCUMENTS = 'Integrations:ProductSources:DocumentUpload';
const WEBSITES = 'Integrations:ProductSources:WebsiteScanning';

/**
 * The two On/Off switches for how tenants give product knowledge its sources: uploading documents, and scanning their website. Neither
 * uses AI (reading scanned pages with AI is its own switch under Product knowledge); these decide whether the platform reads what a tenant
 * hands over at all. Each switch saves at once. Off stops new uploads, new websites and re-reads; what was already read stays.
 */
@Component({
  selector: 'app-platform-product-sources',
  templateUrl: './platform-product-sources.component.html',
  styleUrls: ['./platform-product-sources.component.scss'],
})
export class PlatformProductSourcesComponent implements OnInit {
  loading = true;
  loadFailed = false;
  documentUpload = true;
  websiteScanning = true;
  saving: Record<string, boolean> = {};

  constructor(private readonly settings: SettingsService, private readonly notify: NotificationService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.settings
      .getCategory('Integrations')
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (category) => {
          // A setting never saved has no value: it is On.
          const isOn = (key: string) => (category.items.find((i) => i.key === key)?.value ?? 'true') !== 'false';
          this.documentUpload = isOn(DOCUMENTS);
          this.websiteScanning = isOn(WEBSITES);
        },
        error: () => (this.loadFailed = true),
      });
  }

  setDocuments(on: boolean): void {
    this.save(DOCUMENTS, on, 'Document upload', (v) => (this.documentUpload = v));
  }

  setWebsites(on: boolean): void {
    this.save(WEBSITES, on, 'Website scanning', (v) => (this.websiteScanning = v));
  }

  private save(key: string, on: boolean, name: string, apply: (value: boolean) => void): void {
    if (this.saving[key]) {
      return;
    }
    const before = key === DOCUMENTS ? this.documentUpload : this.websiteScanning;
    apply(on);
    this.saving = { ...this.saving, [key]: true };
    this.settings
      .update('Integrations', { [key]: on ? 'true' : 'false' })
      .pipe(finalize(() => (this.saving = { ...this.saving, [key]: false })))
      .subscribe({
        next: () => this.notify.success(`${name} is switched ${on ? 'on' : 'off'}. It applies from the next request.`),
        // A refused save leaves the switch as it was, never showing a state that was not saved.
        error: () => apply(before),
      });
  }
}
