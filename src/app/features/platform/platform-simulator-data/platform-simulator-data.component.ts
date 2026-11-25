import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import {
  SIMULATOR_CATEGORY_TABS,
  SIMULATOR_VARIANT_LABELS,
  SimulatorDataCategory,
  SimulatorDummyRecord,
  SimulatorKey,
  SimulatorLeadVariant,
  isKeyedCategory,
} from '../../../core/models/simulator-data.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SimulatorDataService } from '../../../core/services/simulator-data.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import {
  PlatformSimulatorDataDialogComponent,
  PlatformSimulatorDataDialogData,
} from '../platform-simulator-data-dialog/platform-simulator-data-dialog.component';

/** Platform admin: the dummy data every simulator uses (lead businesses, AI replies, keywords, task answers, DND numbers, switches). */
@Component({
  selector: 'app-platform-simulator-data',
  templateUrl: './platform-simulator-data.component.html',
  styleUrls: ['./platform-simulator-data.component.scss'],
})
export class PlatformSimulatorDataComponent implements OnInit {
  readonly Category = SimulatorDataCategory;
  readonly tabs = SIMULATOR_CATEGORY_TABS;
  readonly variantLabels = SIMULATOR_VARIANT_LABELS;
  readonly isKeyed = isKeyedCategory;

  records: SimulatorDummyRecord[] = [];
  keys: SimulatorKey[] = [];
  loading = true;
  restoring = false;
  selectedIndex = 0;

  constructor(
    private readonly service: SimulatorDataService,
    private readonly dialog: MatDialog,
    private readonly notify: NotificationService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get current(): SimulatorDataCategory {
    return this.tabs[this.selectedIndex].category;
  }

  rowsOf(category: SimulatorDataCategory): SimulatorDummyRecord[] {
    return this.records.filter((r) => r.category === category);
  }

  columnsOf(category: SimulatorDataCategory): string[] {
    switch (category) {
      case SimulatorDataCategory.LeadBusiness:
        return ['name', 'businessType', 'phone', 'email', 'score', 'variant', 'updated', 'actions'];
      case SimulatorDataCategory.DndNumber:
        return ['name', 'updated', 'actions'];
      default:
        return ['key', 'value', 'updated', 'actions'];
    }
  }

  variantLabel(row: SimulatorDummyRecord): string {
    return this.variantLabels[row.variant ?? SimulatorLeadVariant.Qualified];
  }

  detailsOf(row: SimulatorDummyRecord): string {
    return [row.contactPerson, row.address, row.city].filter((part) => !!part).join(' · ');
  }

  helpOf(row: SimulatorDummyRecord): string {
    return this.keys.find((k) => k.category === row.category && k.key.toLowerCase() === row.name.toLowerCase())?.help ?? '';
  }

  /** Keyed kinds hold one row per listed key; Add is off once every key has its row. */
  freeKeys(category: SimulatorDataCategory, own?: SimulatorDummyRecord): SimulatorKey[] {
    const used = new Set(this.rowsOf(category).filter((r) => r.id !== own?.id).map((r) => r.name.toLowerCase()));
    return this.keys.filter((k) => k.category === category && !used.has(k.key.toLowerCase()));
  }

  canAdd(category: SimulatorDataCategory): boolean {
    return !isKeyedCategory(category) || this.freeKeys(category).length > 0;
  }

  add(): void {
    this.openForm(this.current);
  }

  edit(row: SimulatorDummyRecord): void {
    this.openForm(row.category, row);
  }

  delete(row: SimulatorDummyRecord): void {
    const keyed = isKeyedCategory(row.category);
    const data: ConfirmDialogData = {
      title: 'Delete this dummy data?',
      message: keyed
        ? `"${row.name}" delete hone ke baad simulator iski built-in value use karega. "Restore defaults" se wapas add kar sakte hain.`
        : `"${row.name}" simulator use karna band kar dega. "Restore defaults" sirf starter rows wapas laata hai.`,
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
        this.service.delete(row.id).subscribe(() => {
          this.notify.success('Dummy data delete ho gaya.');
          this.load();
        });
      });
  }

  restoreDefaults(): void {
    const data: ConfirmDialogData = {
      title: 'Restore starter dummy data?',
      message: 'Jo starter rows missing hain wo wapas add ho jayengi. Aapki edit ki hui rows waise hi rahengi.',
      confirmLabel: 'Restore',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '440px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.restoring = true;
        this.service.restoreDefaults().subscribe({
          next: (result) => {
            this.restoring = false;
            this.notify.success(result.added ? `${result.added} starter rows wapas add ho gayi.` : 'Sab starter rows pehle se hain.');
            this.load();
          },
          error: () => (this.restoring = false),
        });
      });
  }

  private openForm(category: SimulatorDataCategory, record?: SimulatorDummyRecord): void {
    const rows = this.rowsOf(category);
    const data: PlatformSimulatorDataDialogData = {
      category,
      record,
      freeKeys: this.freeKeys(category, record),
      nextOrder: rows.length ? Math.max(...rows.map((r) => r.displayOrder)) + 10 : 10,
    };
    this.dialog
      .open(PlatformSimulatorDataDialogComponent, { data, width: '640px', maxWidth: '95vw', disableClose: true })
      .afterClosed()
      .subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  private load(): void {
    this.loading = true;
    this.service.getAll().subscribe({
      next: (result) => {
        this.records = result.records;
        this.keys = result.keys;
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }
}
