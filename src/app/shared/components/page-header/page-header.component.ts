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
        margin-bottom: 16px;
      }
      h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 500;
      }
      p {
        margin: 4px 0 0;
        font-size: 13px;
      }
    `,
  ],
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() subtitle?: string;
}
