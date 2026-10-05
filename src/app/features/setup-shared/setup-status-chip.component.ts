import { Component, Input } from '@angular/core';

import {
  ApplicationSetupStatus,
  SETUP_STATUS_LABELS,
  setupStatusIcon,
  setupStatusTone,
} from '../../core/models/application-setup.model';

/** One consistent pill for an application's setup status, everywhere it is shown. */
@Component({
  selector: 'app-setup-status-chip',
  template: `
    <span class="chip" [ngClass]="tone" [attr.data-status]="status">
      <mat-icon aria-hidden="true">{{ icon }}</mat-icon>
      {{ label }}
    </span>
  `,
  styles: [
    `
      .chip {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 10px 3px 6px;
        border-radius: 14px;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
      }
      mat-icon {
        font-size: 16px;
        width: 16px;
        height: 16px;
      }
      .ok {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .warn {
        background: #fff4e0;
        color: #b26a00;
      }
      .bad {
        background: #fdecea;
        color: #c62828;
      }
      .neutral {
        background: #eceff1;
        color: #546e7a;
      }
    `,
  ],
})
export class SetupStatusChipComponent {
  @Input() status: ApplicationSetupStatus = 'NotStarted';

  get label(): string {
    return SETUP_STATUS_LABELS[this.status];
  }

  get tone(): string {
    return setupStatusTone(this.status);
  }

  get icon(): string {
    return setupStatusIcon(this.status);
  }
}
