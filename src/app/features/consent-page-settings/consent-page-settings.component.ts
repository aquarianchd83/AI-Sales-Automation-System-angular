import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, ValidationErrors, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Observable, of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';

import {
  CONSENT_PAGE_LIMITS,
  CONSENT_STATUS_HELP,
  CONSENT_STATUS_LABELS,
  ConsentPageIssue,
  ConsentPagePreview,
  ConsentPageSettings,
  HTTPS_URL_PATTERN,
  SaveConsentPageSettingsRequest,
  looksLikeMarkup,
} from '../../core/models/consent-page.model';
import { ConsentPageService } from '../../core/services/consent-page.service';
import { NotificationService } from '../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';

const L = CONSENT_PAGE_LIMITS;

/** Plain text only: anything that looks like HTML is refused by the server, so say so before saving. */
function plainText(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '');
  return value && looksLikeMarkup(value) ? { markup: true } : null;
}

/** The customer is agreeing to WhatsApp messages; wording that never says so is not consent to them. Blank means the default wording. */
function mentionsWhatsApp(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim();
  return value && !/whatsapp/i.test(value) ? { whatsapp: true } : null;
}

/**
 * WhatsApp Consent Page Settings - what a customer reads (and agrees to) before WhatsApp messages start. Each tenant writes its own; nothing
 * is shared or pre-filled from anywhere else. Customers only ever see a published version, so editing here changes nothing for them until
 * Publish. The server enforces every rule; the checks here only tell the tenant sooner.
 */
@Component({
  selector: 'app-consent-page-settings',
  templateUrl: './consent-page-settings.component.html',
  styleUrls: ['./consent-page-settings.component.scss'],
})
export class ConsentPageSettingsComponent implements OnInit {
  readonly limits = L;
  readonly statusLabels = CONSENT_STATUS_LABELS;
  readonly statusHelp = CONSENT_STATUS_HELP;

  readonly form = this.fb.nonNullable.group({
    businessName: ['', [Validators.maxLength(L.businessName), plainText]],
    productDescription: ['', [Validators.maxLength(L.productDescription), plainText]],
    additionalInfo: ['', [Validators.maxLength(L.additionalInfo), plainText]],
    consentStatement: ['', [Validators.maxLength(L.consentStatement), plainText, mentionsWhatsApp]],
    privacyPolicyUrl: ['', [Validators.maxLength(L.url), Validators.pattern(HTTPS_URL_PATTERN)]],
    termsUrl: ['', [Validators.maxLength(L.url), Validators.pattern(HTTPS_URL_PATTERN)]],
  });

  settings: ConsentPageSettings | null = null;
  preview: ConsentPagePreview | null = null;

  loading = true;
  loadFailed = false;
  saving = false;
  previewing = false;
  publishing = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly service: ConsentPageService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.loadFailed = false;
    this.service.get().subscribe({
      next: (settings) => {
        this.apply(settings);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.loadFailed = true;
      },
    });
  }

  get busy(): boolean {
    return this.saving || this.previewing || this.publishing;
  }

  /** What the server says is still missing for the saved draft, for one field. */
  issueFor(field: string): string | null {
    return this.settings?.issues.find((i) => i.field === field)?.message ?? null;
  }

  get issues(): ConsentPageIssue[] {
    return this.settings?.issues ?? [];
  }

  get status(): ConsentPageSettings['status'] {
    return this.settings?.status ?? 'Incomplete';
  }

  get isLive(): boolean {
    return this.status === 'Published';
  }

  /** The statement the customer will read when this field is left blank. */
  get defaultStatement(): string {
    const name = this.form.controls.businessName.value.trim();
    const base = this.settings?.defaultConsentStatement ?? '';
    return name ? base.replace('[Business Name]', name) : base;
  }

  useDefaultStatement(): void {
    this.form.controls.consentStatement.setValue(this.defaultStatement);
    this.form.controls.consentStatement.markAsDirty();
  }

  onSave(): void {
    if (!this.canSubmit() || this.busy) {
      return;
    }
    this.saving = true;
    this.saveDraft()
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => this.notify.success('Saved. Customers will not see these changes until you publish.'),
        error: () => undefined, // the error interceptor shows why
      });
  }

  /** Shows the saved draft as the customer will see it. Saves first so what is shown is what is stored. */
  onPreview(): void {
    if (!this.canSubmit() || this.busy) {
      return;
    }
    this.previewing = true;
    this.saveIfChanged()
      .pipe(
        switchMap(() => this.service.preview()),
        finalize(() => (this.previewing = false))
      )
      .subscribe({
        next: (preview) => (this.preview = preview),
        error: () => undefined,
      });
  }

  closePreview(): void {
    this.preview = null;
  }

  onPublish(): void {
    if (!this.canSubmit() || this.busy) {
      return;
    }
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Publish consent page',
          message:
            'Customers who open their link will see this page and the wording they agree to. Earlier answers keep the wording they were given.',
          confirmLabel: 'Publish',
        },
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (confirmed) {
          this.publish();
        }
      });
  }

  toggleActive(): void {
    if (!this.settings || this.busy) {
      return;
    }
    const turnOn = !this.settings.isActive;
    this.publishing = true;
    this.service
      .setActive(turnOn)
      .pipe(finalize(() => (this.publishing = false)))
      .subscribe({
        next: (settings) => {
          this.settings = settings;
          this.notify.success(turnOn ? 'The consent page is live again.' : 'The consent page is switched off. Customer discovery will not start.');
        },
        error: () => undefined,
      });
  }

  private publish(): void {
    this.publishing = true;
    this.saveIfChanged()
      .pipe(
        switchMap(() => this.service.publish()),
        finalize(() => (this.publishing = false))
      )
      .subscribe({
        next: (settings) => {
          this.apply(settings);
          this.preview = null;
          this.notify.success(`Published (version ${settings.publishedVersion}). Customer discovery can now run.`);
        },
        // The interceptor shows the reason; reload so the list of what is missing is current.
        error: () => this.reloadIssues(),
      });
  }

  private canSubmit(): boolean {
    this.form.markAllAsTouched();
    return this.form.valid;
  }

  private saveIfChanged(): Observable<unknown> {
    return this.form.dirty || !this.settings ? this.saveDraft() : of(null);
  }

  private saveDraft(): Observable<ConsentPageSettings> {
    return this.service.save(this.toRequest()).pipe(
      switchMap((settings) => {
        this.apply(settings);
        return of(settings);
      })
    );
  }

  private reloadIssues(): void {
    this.service.get().subscribe({ next: (settings) => (this.settings = settings), error: () => undefined });
  }

  private apply(settings: ConsentPageSettings): void {
    this.settings = settings;
    this.form.reset(
      {
        businessName: settings.businessName ?? '',
        productDescription: settings.productDescription ?? '',
        additionalInfo: settings.additionalInfo ?? '',
        consentStatement: settings.consentStatement ?? '',
        privacyPolicyUrl: settings.privacyPolicyUrl ?? '',
        termsUrl: settings.termsUrl ?? '',
      },
      { emitEvent: false }
    );
  }

  private toRequest(): SaveConsentPageSettingsRequest {
    const v = this.form.getRawValue();
    const blank = (value: string): string | null => (value.trim() ? value.trim() : null);
    return {
      businessName: blank(v.businessName),
      productDescription: blank(v.productDescription),
      additionalInfo: blank(v.additionalInfo),
      consentStatement: blank(v.consentStatement),
      privacyPolicyUrl: blank(v.privacyPolicyUrl),
      termsUrl: blank(v.termsUrl),
    };
  }
}
