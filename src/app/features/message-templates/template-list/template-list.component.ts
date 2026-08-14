import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { Subject, of } from 'rxjs';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  startWith,
  switchMap,
  takeUntil,
} from 'rxjs/operators';

import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS, PagedQuery, PagedResult, emptyPage } from '../../../core/models/paged-result.model';
import {
  MessageTemplate,
  WhatsAppTemplateStatus,
  templateStatusChipClass,
} from '../../../core/models/message-template.model';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TemplateFormDialogComponent, TemplateFormDialogData } from '../template-form-dialog/template-form-dialog.component';

@Component({
  selector: 'app-template-list',
  templateUrl: './template-list.component.html',
  styleUrls: ['./template-list.component.scss'],
})
export class TemplateListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = [
    'name',
    'whatsAppTemplateName',
    'category',
    'status',
    'isActive',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly statusClass = templateStatusChipClass;
  readonly WhatsAppTemplateStatus = WhatsAppTemplateStatus;

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<MessageTemplate> = emptyPage<MessageTemplate>();
  loading = true;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  private readonly reload$ = new Subject<void>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly templates: MessageTemplateService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((search) => {
        this.query = { ...this.query, page: 1, search: search || undefined };
        this.paginator?.firstPage();
        this.reload$.next();
      });

    this.reload$
      .pipe(
        startWith(undefined),
        switchMap(() => {
          this.loading = true;
          return this.templates.getPaged(this.query).pipe(
            catchError(() => of(emptyPage<MessageTemplate>(this.query.pageSize))),
            finalize(() => (this.loading = false))
          );
        }),
        takeUntil(this.destroy$)
      )
      .subscribe((page) => (this.page = page));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onPage(event: PageEvent): void {
    this.query = { ...this.query, page: event.pageIndex + 1, pageSize: event.pageSize };
    this.reload$.next();
  }

  create(): void {
    this.openForm({ mode: 'create' });
  }

  edit(template: MessageTemplate): void {
    this.openForm({ mode: 'edit', template });
  }

  review(template: MessageTemplate, status: WhatsAppTemplateStatus): void {
    const verb = status === WhatsAppTemplateStatus.Approved ? 'Approve' : 'Reject';
    const data: ConfirmDialogData = {
      title: `${verb} "${template.name}"?`,
      message:
        status === WhatsAppTemplateStatus.Approved
          ? 'Once approved, this template can be assigned to a campaign step and used to start a campaign.'
          : 'A rejected template cannot be used to start a campaign until it is approved.',
      confirmLabel: verb,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.templates.review(template.id, { status }).subscribe(() => {
          this.notify.success(`Template ${status === WhatsAppTemplateStatus.Approved ? 'approved' : 'rejected'}.`);
          this.reload$.next();
        });
      });
  }

  resetToPending(template: MessageTemplate): void {
    this.templates.review(template.id, { status: WhatsAppTemplateStatus.Pending }).subscribe(() => {
      this.notify.success('Template reset to Pending.');
      this.reload$.next();
    });
  }

  delete(template: MessageTemplate): void {
    const data: ConfirmDialogData = {
      title: `Delete "${template.name}"?`,
      message:
        'This cannot be undone. A template still referenced by a campaign step cannot be deleted — remove it from the step first.',
      confirmLabel: 'Delete',
      destructive: true,
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '460px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.templates.delete(template.id).subscribe(() => {
          this.notify.success('Template deleted.');
          this.reload$.next();
        });
      });
  }

  private openForm(data: TemplateFormDialogData): void {
    this.dialog
      .open(TemplateFormDialogComponent, { data, width: '620px', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.reload$.next();
        }
      });
  }
}
