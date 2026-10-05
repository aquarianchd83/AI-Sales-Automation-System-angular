import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import { PlanApplication, needsSetup } from '../../../core/models/application-setup.model';
import { ApplicationService } from '../../../core/services/application.service';
import { NotificationService } from '../../../core/services/notification.service';
import { NewApplicationDialogComponent } from '../new-application-dialog/new-application-dialog.component';

/** Every application the tenant has, with where its setup stands and the one action that matters next. */
@Component({
  selector: 'app-application-list',
  templateUrl: './application-list.component.html',
  styleUrls: ['./application-list.component.scss'],
})
export class ApplicationListComponent implements OnInit {
  applications: PlanApplication[] = [];
  loading = true;
  runningId: string | null = null;

  constructor(
    private readonly service: ApplicationService,
    private readonly dialog: MatDialog,
    private readonly router: Router,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.service
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe((applications) => (this.applications = applications));
  }

  needsSetup(app: PlanApplication): boolean {
    return needsSetup(app.setupStatus);
  }

  create(): void {
    this.dialog
      .open(NewApplicationDialogComponent, { width: '720px', maxWidth: '95vw', disableClose: true })
      .afterClosed()
      .subscribe((created: PlanApplication | undefined) => {
        if (created) {
          // Straight into the wizard: the next thing a new application needs is its setup.
          void this.router.navigate(['/applications', created.id, 'setup']);
        }
      });
  }

  open(app: PlanApplication): void {
    void this.router.navigate(['/applications', app.id]);
  }

  setup(app: PlanApplication, event?: Event): void {
    event?.stopPropagation();
    void this.router.navigate(['/applications', app.id, 'setup']);
  }

  run(app: PlanApplication, event?: Event): void {
    event?.stopPropagation();
    if (!app.canExecute) {
      this.notify.error('Please complete the required setup before running this application.');
      this.setup(app);
      return;
    }
    this.runningId = app.id;
    this.service
      .execute(app.id)
      .pipe(finalize(() => (this.runningId = null)))
      .subscribe({
        next: () => {
          this.notify.success(`${app.name} is running.`);
          this.load();
        },
        error: () => this.load(), // the interceptor already showed why; refresh so the status is current
      });
  }

  trackById(_: number, app: PlanApplication): string {
    return app.id;
  }
}
