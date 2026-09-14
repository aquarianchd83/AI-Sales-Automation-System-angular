import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { ANNOUNCEMENT_SEVERITY_LABELS, Announcement } from '../../../core/models/platform.model';
import { AnnouncementService } from '../../../core/services/announcement.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { PlatformAnnouncementFormDialogComponent } from '../platform-announcement-form-dialog/platform-announcement-form-dialog.component';

@Component({
  selector: 'app-platform-announcement-list',
  templateUrl: './platform-announcement-list.component.html',
  styleUrls: ['./platform-announcement-list.component.scss'],
})
export class PlatformAnnouncementListComponent implements OnInit {
  readonly severityLabels = ANNOUNCEMENT_SEVERITY_LABELS;

  announcements: Announcement[] = [];
  loading = true;

  constructor(
    private readonly announcementService: AnnouncementService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  create(): void {
    this.openForm();
  }

  edit(announcement: Announcement): void {
    this.openForm(announcement);
  }

  delete(announcement: Announcement): void {
    const data: ConfirmDialogData = {
      title: 'Delete this announcement?',
      message: `"${announcement.title}" will stop showing immediately and cannot be recovered.`,
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.announcementService.delete(announcement.id).subscribe(() => {
          this.notify.success('Announcement deleted.');
          this.load();
        });
      });
  }

  private openForm(announcement?: Announcement): void {
    this.dialog
      .open(PlatformAnnouncementFormDialogComponent, { data: { announcement }, width: '520px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  private load(): void {
    this.loading = true;
    this.announcementService.getAll().subscribe({
      next: (announcements) => {
        this.announcements = announcements;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }
}
