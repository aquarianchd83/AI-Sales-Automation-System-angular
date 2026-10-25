import { Component, OnInit } from '@angular/core';

import { DemoSms, DemoSmsOutboxService } from '../../core/services/demo-sms-outbox.service';

/**
 * Demo SMS Outbox: every SMS the simulated provider "sent" for this tenant, newest first, each with its consent link to click. Stands in for
 * the phone. Opening a link only shows the consent page - nothing is agreed until the Yes / No button is pressed on it.
 */
@Component({
  selector: 'app-demo-sms-outbox',
  templateUrl: './demo-sms-outbox.component.html',
  styleUrls: ['./demo-sms-outbox.component.scss'],
})
export class DemoSmsOutboxComponent implements OnInit {
  messages: DemoSms[] = [];
  loading = true;
  /** 'off' = the API says the demo outbox is not switched on; 'failed' = it could not be reached. */
  problem: 'off' | 'failed' | null = null;

  constructor(private readonly outbox: DemoSmsOutboxService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.problem = null;
    this.outbox.list().subscribe({
      next: (messages) => {
        this.messages = messages;
        this.loading = false;
      },
      error: (error) => {
        this.loading = false;
        this.problem = error?.status === 404 ? 'off' : 'failed';
      },
    });
  }

  /** The text of the SMS without its link, which is shown as a button. */
  textOf(sms: DemoSms): string {
    return sms.link ? sms.body.replace(sms.link, '').trim() : sms.body;
  }
}
