import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';

import {
  ConsentChoice,
  ConsentDecisionResult,
  ConsentPageContent,
  PublicConsentPage,
} from '../../core/models/consent-page.model';
import { PublicConsentService } from '../../core/services/public-consent.service';

type View = 'loading' | 'ready' | 'answered' | 'unavailable' | 'expired' | 'invalid' | 'error';

/**
 * What the customer sees after tapping the link in the SMS. Anonymous.
 *
 * Opening this page changes nothing: it only reads. Consent exists only when the customer ticks the (unticked-by-default) box and presses
 * "Yes, I Agree"; "No, Not Interested" needs no box. Both are POSTs the server validates again - the disabled button here is a courtesy, not
 * the rule. Nothing about the customer is on the page, and the link is kept out of referrers and search results.
 */
@Component({
  selector: 'app-public-consent',
  templateUrl: './public-consent.component.html',
  styleUrls: ['./public-consent.component.scss'],
})
export class PublicConsentComponent implements OnInit, OnDestroy {
  /** Never ticked for the customer. */
  readonly agree = new FormControl(false, { nonNullable: true });

  view: View = 'loading';
  page: ConsentPageContent | null = null;
  message: string | null = null;
  /** What the customer chose, once it is saved: shown as the confirmation. */
  answered: ConsentChoice | null = null;
  submitting: ConsentChoice | null = null;

  private token = '';
  private readonly addedTags: HTMLMetaElement[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly consent: PublicConsentService,
    private readonly title: Title,
    private readonly meta: Meta
  ) {}

  ngOnInit(): void {
    // The link is a secret: keep it out of search results, and out of the Referer sent to the policy pages linked below.
    this.title.setTitle('WhatsApp preferences');
    for (const tag of [
      { name: 'robots', content: 'noindex, nofollow' },
      { name: 'referrer', content: 'no-referrer' },
    ]) {
      const element = this.meta.addTag(tag, false);
      if (element) {
        this.addedTags.push(element);
      }
    }

    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.load();
  }

  ngOnDestroy(): void {
    this.addedTags.forEach((tag) => tag.remove());
  }

  load(): void {
    this.view = 'loading';
    this.consent.getPage(this.token).subscribe({
      next: (result) => this.show(result),
      error: () => (this.view = 'error'),
    });
  }

  /** "Yes" is available only once the box is ticked. "No" is always available. */
  get canAgree(): boolean {
    return this.agree.value && !this.submitting;
  }

  get canDecline(): boolean {
    return !this.submitting;
  }

  /** A link to a policy page, only ever an https address (the server insists on it too). */
  safeLink(url: string | null): string | null {
    return url && /^https:\/\//i.test(url) ? url : null;
  }

  submit(choice: ConsentChoice): void {
    if (this.submitting || !this.page) {
      return;
    }
    if (choice === 'agree' && !this.agree.value) {
      return;
    }

    this.submitting = choice;
    this.message = null;
    this.consent
      .decide(this.token, { decision: choice, consentChecked: choice === 'agree' && this.agree.value, pageVersion: this.page.version })
      .subscribe({
        next: (result) => {
          this.submitting = null;
          this.onResult(choice, result);
        },
        error: () => {
          this.submitting = null;
          this.message = 'Something went wrong and your answer was not saved. Please try again.';
        },
      });
  }

  private onResult(choice: ConsentChoice, result: ConsentDecisionResult): void {
    switch (result.outcome) {
      case 'Recorded':
      case 'AlreadyRecorded':
        this.answered = choice;
        this.message = result.message;
        this.view = 'answered';
        return;
      case 'PageChanged':
        // The wording changed while the page was open: show the new page, unticked, and ask again.
        this.agree.setValue(false);
        if (result.page) {
          this.show(result.page);
        }
        this.message = result.message;
        return;
      case 'Expired':
        this.view = 'expired';
        return;
      case 'Invalid':
        this.view = 'invalid';
        return;
      case 'Unavailable':
        this.view = 'unavailable';
        return;
      case 'Conflict':
        // They already answered the other way; say what is on record.
        this.answered = result.decision === 'Granted' ? 'agree' : 'decline';
        this.message = result.message;
        this.view = 'answered';
        return;
      default:
        // BadRequest, NotAllowed: stay on the page and say why.
        this.message = result.message;
    }
  }

  private show(result: PublicConsentPage): void {
    this.page = result.page;
    this.message = result.message;
    switch (result.state) {
      case 'Ready':
        this.view = 'ready';
        break;
      case 'Answered':
        this.answered = result.decision === 'Granted' ? 'agree' : 'decline';
        this.view = 'answered';
        break;
      case 'Unavailable':
        this.view = 'unavailable';
        break;
      case 'Expired':
        this.view = 'expired';
        break;
      default:
        this.view = 'invalid';
    }
  }
}
