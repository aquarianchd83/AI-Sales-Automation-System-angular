import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { ApplicationSetup, SetupAnswers } from '../../../core/models/application-setup.model';
import { ApplicationService } from '../../../core/services/application.service';
import { CurrencySymbolService } from '../../../core/services/currency-symbol.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { SetupSaveEvent } from '../../setup-shared/setup-wizard/setup-wizard.component';
import { ChangePlanDialogComponent, ChangePlanDialogData } from '../change-plan-dialog/change-plan-dialog.component';

/** The guided setup for one application. All the questions come from its plan version; this page only hosts the wizard and saves. */
@Component({
  selector: 'app-application-setup-page',
  templateUrl: './application-setup-page.component.html',
  styleUrls: ['./application-setup-page.component.scss'],
})
export class ApplicationSetupPageComponent implements OnInit, OnDestroy {
  setup: ApplicationSetup | null = null;
  /** Fixed at load (and after a plan change / migration) - NOT updated per save, so the wizard keeps its own in-progress state. */
  initialValues: SetupAnswers = {};
  currencySymbol = '';
  loading = true;
  saving = false;
  migrating = false;

  readonly reason = new FormControl<string>('', { nonNullable: true, validators: [Validators.maxLength(500)] });

  private id = '';
  private readonly subscription = new Subscription();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly service: ApplicationService,
    private readonly currency: CurrencySymbolService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') ?? '';
    this.subscription.add(this.currency.get().subscribe((symbol) => (this.currencySymbol = symbol)));
    this.load();
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  get alreadyCompleted(): boolean {
    return this.setup?.application.setupCompletedAt != null;
  }

  private load(): void {
    this.loading = true;
    this.service
      .getSetup(this.id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (setup) => this.show(setup),
        error: () => void this.router.navigate(['/applications']),
      });
  }

  private show(setup: ApplicationSetup): void {
    this.setup = setup;
    this.initialValues = setup.values;
  }

  onSave(event: SetupSaveEvent): void {
    this.saving = true;
    this.service
      .saveSetup(this.id, {
        values: event.values,
        complete: event.complete,
        reason: this.reason.value.trim() || null,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (result) => {
          if (this.setup) {
            // Keep the questions and answers as they are; only the header (status, progress) follows the server.
            this.setup = { ...this.setup, application: result.setup.application, projection: result.setup.projection };
          }
          event.done({ ok: true, completed: result.completed, evaluation: result.setup.evaluation });

          if (event.complete) {
            if (result.completed) {
              this.notify.success('Setup completed. You can now run this application.');
              void this.router.navigate(['/applications', this.id]);
            } else {
              this.notify.error('Some answers still need attention before the setup can be completed.');
            }
          } else if (event.exit) {
            this.notify.success('Progress saved.');
            void this.router.navigate(['/applications', this.id]);
          }
        },
        error: () => event.done({ ok: false }),
      });
  }

  exit(): void {
    void this.router.navigate(['/applications', this.id]);
  }

  changePlan(): void {
    if (!this.setup) {
      return;
    }
    const data: ChangePlanDialogData = { application: this.setup.application };
    this.dialog
      .open(ChangePlanDialogComponent, { data, width: '720px', maxWidth: '95vw', disableClose: true })
      .afterClosed()
      .subscribe((updated: ApplicationSetup | undefined) => {
        if (updated) {
          this.show(updated);
          this.notify.success(`Moved to ${updated.application.planName}. Your matching answers were kept.`);
        }
      });
  }

  migrate(): void {
    if (!this.setup) {
      return;
    }
    const data: ConfirmDialogData = {
      title: 'Update to the newest version?',
      message:
        `This moves "${this.setup.application.name}" to the latest version of ${this.setup.application.planName}. ` +
        'All your answers are kept; you will only be asked for anything new. Until then, this application keeps working on its current version.',
      confirmLabel: 'Update',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '480px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.migrating = true;
        this.service
          .migrate(this.id)
          .pipe(finalize(() => (this.migrating = false)))
          .subscribe((updated) => {
            this.show(updated);
            this.notify.success('Updated to the newest version.');
          });
      });
  }
}
