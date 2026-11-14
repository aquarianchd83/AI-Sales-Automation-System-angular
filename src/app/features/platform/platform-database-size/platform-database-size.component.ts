import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, filter, finalize, switchMap, takeUntil } from 'rxjs/operators';
import { of } from 'rxjs';

import { CleanableTable, CleanupPreview, CleanupPreviewItem, DatabaseSize } from '../../../core/models/platform.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformDatabaseSizeService } from '../../../core/services/platform-database-size.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

const MB_PER_GB = 1024;

@Component({
  selector: 'app-platform-database-size',
  templateUrl: './platform-database-size.component.html',
  styleUrls: ['./platform-database-size.component.scss'],
})
export class PlatformDatabaseSizeComponent implements OnInit, OnDestroy {
  readonly displayedColumns = ['name', 'rows', 'size', 'share'];

  /** The quota is entered in GB (what people think in); it is stored in MB. Empty or 0 = no quota, detect from the server. */
  readonly quotaForm = new FormGroup({
    quotaGb: new FormControl<number | null>(null, [Validators.min(0)]),
    thresholdPercent: new FormControl<number>(80, { nonNullable: true, validators: [Validators.required, Validators.min(1), Validators.max(100)] }),
    autoCleanup: new FormControl<boolean>(false, { nonNullable: true }),
    cleanupRetentionDays: new FormControl<number>(30, { nonNullable: true, validators: [Validators.required, Validators.min(7)] }),
    /** Keys of the tables the clean-up may erase from. */
    cleanupTables: new FormControl<string[]>([], { nonNullable: true }),
  });

  data: DatabaseSize | null = null;
  loading = true;
  saving = false;

  /** What each clean-up table would free, by table key; refreshed when the days to keep change. */
  preview: CleanupPreview | null = null;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly service: PlatformDatabaseSizeService,
    private readonly settings: SettingsService,
    private readonly notify: NotificationService,
    private readonly dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.load();

    // Re-estimate as the owner types a different number of days to keep, so the percentages answer "what if" before anything is saved.
    this.quotaForm.controls.cleanupRetentionDays.valueChanges
      .pipe(
        filter(() => this.quotaForm.controls.cleanupRetentionDays.valid),
        debounceTime(400),
        distinctUntilChanged(),
        switchMap((days) => this.service.getCleanupPreview(days).pipe(catchError(() => of(null)))),
        takeUntil(this.destroy$)
      )
      .subscribe((preview) => {
        if (preview) this.preview = preview;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  previewFor(key: string): CleanupPreviewItem | undefined {
    return this.preview?.tables.find((t) => t.key === key);
  }

  /** "frees ~1.2%" for a table's title; "nothing to erase" when no row is old enough. */
  freesLabel(key: string): string | null {
    const p = this.previewFor(key);
    if (!p) return null;
    if (p.eligibleRows === 0) return 'nothing old enough';
    return p.estimatedFreedPercent > 0 && p.estimatedFreedPercent < 0.1 ? 'frees <0.1%' : `frees ~${p.estimatedFreedPercent.toFixed(1)}%`;
  }

  freesTooltip(key: string): string {
    const p = this.previewFor(key);
    if (!p) return '';
    return (
      `${p.eligibleRows.toLocaleString()} of ${p.totalRows.toLocaleString()} rows are older than ${p.keepDays} days. ` +
      `Estimated ${this.formatMb(p.estimatedFreedMb)} of this table's ${this.formatMb(p.tableMb)} - an estimate, assuming old rows are about as large as the rest.`
    );
  }

  max0(n: number): number {
    return Math.max(0, n);
  }

  /** The selected tables together: space freed (MB) and its percentage. */
  get selectedTotals(): { mb: number; percent: number; rows: number } {
    const selected = this.quotaForm.controls.cleanupTables.value;
    const items = (this.preview?.tables ?? []).filter((t) => selected.includes(t.key));
    return {
      mb: items.reduce((sum, t) => sum + t.estimatedFreedMb, 0),
      percent: items.reduce((sum, t) => sum + t.estimatedFreedPercent, 0),
      rows: items.reduce((sum, t) => sum + t.eligibleRows, 0),
    };
  }

  load(): void {
    this.loading = true;
    this.service
      .get()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (data) => {
          this.data = data;
          // Don't overwrite what the operator is typing when they only pressed Refresh.
          if (this.quotaForm.pristine) this.resetForm(data);
          this.loadPreview(this.quotaForm.controls.cleanupRetentionDays.value);
        },
        error: () => {
          /* ErrorInterceptor toasts it */
        },
      });
  }

  private loadPreview(days: number): void {
    this.service.getCleanupPreview(Math.max(days || 30, 7)).subscribe({
      next: (preview) => (this.preview = preview),
      error: () => {
        /* ErrorInterceptor toasts it */
      },
    });
  }

  isTableSelected(key: string): boolean {
    return this.quotaForm.controls.cleanupTables.value.includes(key);
  }

  toggleTable(table: CleanableTable, checked: boolean): void {
    const control = this.quotaForm.controls.cleanupTables;
    const without = control.value.filter((k) => k !== table.key);
    control.setValue(checked ? [...without, table.key] : without);
    control.markAsDirty();
    this.quotaForm.markAsDirty();
  }

  /** Business-data tables the owner has ticked - saving those asks for an explicit confirmation. */
  private get selectedBusinessTables(): CleanableTable[] {
    return (this.data?.cleanableTables ?? []).filter((t) => t.isBusinessData && this.isTableSelected(t.key));
  }

  get businessDataSelected(): boolean {
    return this.selectedBusinessTables.length > 0;
  }

  saveQuota(): void {
    if (this.quotaForm.invalid || this.saving) return;

    const risky = this.selectedBusinessTables;
    const alreadySaved = new Set((this.data?.cleanableTables ?? []).filter((t) => t.selected).map((t) => t.key));
    const newlyRisky = risky.filter((t) => !alreadySaved.has(t.key));
    if (this.quotaForm.controls.autoCleanup.value && newlyRisky.length) {
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Allow erasing customer data?',
            message:
              `You are letting the automatic clean-up permanently delete old ${newlyRisky.map((t) => t.label.toLowerCase()).join(', ')} ` +
              `when the database reaches the alert level. This cannot be undone.`,
            confirmLabel: 'Yes, allow it',
            destructive: true,
          },
          width: '480px',
        })
        .afterClosed()
        .subscribe((ok) => {
          if (ok) this.persist();
        });
      return;
    }
    this.persist();
  }

  private persist(): void {
    const { quotaGb, thresholdPercent, autoCleanup, cleanupRetentionDays, cleanupTables } = this.quotaForm.getRawValue();
    const mb = Math.round((quotaGb ?? 0) * MB_PER_GB);

    this.saving = true;
    this.settings
      .update('DatabaseSizeMonitor', {
        'DatabaseSizeMonitor:CapacityMb': String(mb),
        'DatabaseSizeMonitor:ThresholdPercent': String(thresholdPercent),
        'DatabaseSizeMonitor:AutoCleanup': String(autoCleanup),
        'DatabaseSizeMonitor:CleanupRetentionDays': String(cleanupRetentionDays),
        'DatabaseSizeMonitor:CleanupTables': cleanupTables.join(','),
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.notify.success('Database settings saved.');
          this.quotaForm.markAsPristine();
          this.load();
        },
        error: () => {
          /* ErrorInterceptor toasts it */
        },
      });
  }

  clearQuota(): void {
    this.quotaForm.controls.quotaGb.setValue(null);
    this.quotaForm.markAsDirty();
  }

  /** The bar turns to the warning colour at the server's own alert level, so it tracks that setting. */
  get barColor(): 'primary' | 'warn' {
    return this.data?.overThreshold ? 'warn' : 'primary';
  }

  /** Sizes under a GB read in MB, above it in GB. */
  formatMb(mb: number): string {
    return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`;
  }

  /** Days the clean-up really keeps for a table: the owner's number, raised to the table's own floor. */
  keepDaysFor(table: CleanableTable): number {
    return Math.max(this.quotaForm.controls.cleanupRetentionDays.value || 0, table.floorDays, 7);
  }

  private resetForm(data: DatabaseSize): void {
    this.quotaForm.reset({
      quotaGb: data.configuredCapacityMb > 0 ? Number((data.configuredCapacityMb / MB_PER_GB).toFixed(3)) : null,
      thresholdPercent: data.thresholdPercent,
      autoCleanup: data.autoCleanup,
      cleanupRetentionDays: data.cleanupRetentionDays,
      cleanupTables: data.cleanableTables.filter((t) => t.selected).map((t) => t.key),
    });
  }
}
