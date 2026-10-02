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
  TEMPLATE_RULE_GROUPS,
  WhatsAppTemplateStatus,
  templateCategoryInfo,
  templateStatusChipClass,
} from '../../../core/models/message-template.model';
import { environment } from '../../../../environments/environment';
import { mediaPreviewUrl } from '../../../core/models/media.model';
import { MessageTemplateService } from '../../../core/services/message-template.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TemplateFormDialogComponent, TemplateFormDialogData } from '../template-form-dialog/template-form-dialog.component';

const RULES_OPEN_KEY = 'templates.rulesOpen';

/** Storage can be unavailable (private window, blocked site data), so this must never throw. */
function readRulesOpen(): boolean {
  try {
    return localStorage.getItem(RULES_OPEN_KEY) !== 'false';
  } catch {
    return true;
  }
}

@Component({
  selector: 'app-template-list',
  templateUrl: './template-list.component.html',
  styleUrls: ['./template-list.component.scss'],
})
export class TemplateListComponent implements OnInit, OnDestroy {
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  readonly displayedColumns = [
    'name',
    'image',
    'whatsAppTemplateName',
    'category',
    'status',
    'isActive',
    'actions',
  ];
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly preview = (url: string): string => mediaPreviewUrl(url, environment.apiBaseUrl);
  readonly statusClass = templateStatusChipClass;
  readonly categoryInfo = templateCategoryInfo;
  readonly WhatsAppTemplateStatus = WhatsAppTemplateStatus;
  readonly ruleGroups = TEMPLATE_RULE_GROUPS;

  /** Open the first time, then stays as the user left it. */
  rulesOpen = readRulesOpen();

  readonly searchControl = new FormControl<string>('', { nonNullable: true });

  page: PagedResult<MessageTemplate> = emptyPage<MessageTemplate>();
  loading = true;

  private query: PagedQuery = { page: 1, pageSize: DEFAULT_PAGE_SIZE };
  /** Template ids with a Sync in flight, so one slow sync only disables its own row's button. */
  private readonly syncing = new Set<string>();
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

  setRulesOpen(open: boolean): void {
    this.rulesOpen = open;
    try {
      localStorage.setItem(RULES_OPEN_KEY, String(open));
    } catch {
      // Remembering the panel's state is a convenience; the page works without it.
    }
  }

  create(): void {
    this.openForm({ mode: 'create' });
  }

  edit(template: MessageTemplate): void {
    this.openForm({ mode: 'edit', template });
  }

  /** The create form, pre-filled from this template - how to "change" what Meta will not let you change on the original. */
  duplicate(template: MessageTemplate): void {
    this.openForm({ mode: 'duplicate', template });
  }

  isSyncing(template: MessageTemplate): boolean {
    return this.syncing.has(template.id);
  }

  /** Asks Meta for this template's current review status. Meta decides it; nothing here can override it. */
  sync(template: MessageTemplate): void {
    this.syncing.add(template.id);
    this.templates
      .syncOne(template.id)
      .pipe(finalize(() => this.syncing.delete(template.id)))
      .subscribe({
        next: (result) => {
          if (result.pushError) {
            this.notify.error(`Meta did not accept "${template.name}": ${result.pushError}`);
          } else if (!template.metaTemplateId && result.template.metaTemplateId) {
            this.notify.success(
              `"${template.name}" was submitted to Meta. Meta says it is ${result.template.whatsAppTemplateStatus}; ` +
                'the status updates here when Meta finishes its review.'
            );
          } else if (result.template.category !== template.category) {
            // Meta reclassified it on review; the sync already moved the local copy to match.
            this.notify.info(
              `Meta moved "${template.name}" from ${template.category} to ${result.template.category}. The category here now matches Meta.`
            );
          } else if (result.template.whatsAppTemplateStatus === WhatsAppTemplateStatus.Approved) {
            this.notify.success(`Meta has approved "${template.name}".`);
          } else {
            this.notify.info(
              `Meta says "${template.name}" is ${result.template.whatsAppTemplateStatus}. It can be used in a campaign once Meta approves it.`
            );
          }
          this.reload$.next();
        },
        error: () => {
          // ErrorInterceptor toasts it.
        },
      });
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
      .subscribe((result) => {
        if (result === 'duplicate' && data.template) {
          // The edit dialog offered a copy instead; nothing was saved, so there is nothing to reload.
          this.duplicate(data.template);
        } else if (result) {
          this.reload$.next();
        }
      });
  }
}
