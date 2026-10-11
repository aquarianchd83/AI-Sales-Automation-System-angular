import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <div class="header">
      <div>
        <h1>{{ title }}</h1>
        <p class="muted" *ngIf="subtitle">{{ subtitle }}</p>
      </div>
      <span class="spacer"></span>
      <ng-content></ng-content>
    </div>
  `,
  styles: [
    `
      .header {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
        margin-bottom: 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid var(--app-border);
      }
      h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        letter-spacing: -0.3px;
      }
      p {
        margin: 4px 0 0;
        font-size: 13.5px;
        color: var(--app-muted);
      }
    `,
  ],
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle?: string;
}
