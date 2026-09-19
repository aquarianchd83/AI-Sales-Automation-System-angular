import { Injectable } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';

const MIN_WIDTH = 320;
const MIN_HEIGHT = 180;
const MARGIN = 16;

/**
 * Makes every Material dialog movable (drag its title) and resizable (drag the bottom-right
 * corner). Dialogs are centred by a flex overlay, so a move is a CSS translate, and a resize also
 * shifts by half the size change so the corner stays under the pointer.
 */
@Injectable({ providedIn: 'root' })
export class DialogInteractionService {
  constructor(private readonly dialog: MatDialog) {}

  init(): void {
    this.dialog.afterOpened.subscribe((ref) => this.enhance(ref));
  }

  private enhance(ref: MatDialogRef<unknown>): void {
    // Material 15 puts no id on the container (ref.id is not a DOM id), so ask the ref for it.
    const container: HTMLElement | undefined = (
      ref as unknown as { _containerInstance?: { _elementRef: { nativeElement: HTMLElement } } }
    )._containerInstance?._elementRef.nativeElement;
    const pane = container?.closest<HTMLElement>('.cdk-overlay-pane');
    if (!container || !pane) {
      return;
    }

    // The pane is not tagged with a dialog class by Material 15, and CDK sets it position: static
    // inline; the handle needs it positioned.
    pane.classList.add('interactive-dialog-pane');
    pane.style.position = 'relative';

    let tx = 0;
    let ty = 0;
    const apply = () => (pane.style.transform = `translate(${tx}px, ${ty}px)`);

    const drag = (start: PointerEvent, onMove: (dx: number, dy: number) => void) => {
      start.preventDefault();
      const move = (e: PointerEvent) => onMove(e.clientX - start.clientX, e.clientY - start.clientY);
      const end = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', end);
        document.removeEventListener('pointercancel', end);
        document.body.style.userSelect = '';
      };
      document.body.style.userSelect = 'none';
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', end);
      document.addEventListener('pointercancel', end);
    };

    // Move: grab the title bar (delegated, so a title rendered later still works), but leave its
    // buttons and inputs alone.
    container.addEventListener('pointerdown', (e) => {
      const target = e.target as HTMLElement;
      if (e.button !== 0 || !target.closest('.mat-mdc-dialog-title') || target.closest('button, a, input, select, textarea')) {
        return;
      }
      const x0 = tx;
      const y0 = ty;
      drag(e, (dx, dy) => {
        tx = x0 + dx;
        ty = y0 + dy;
        apply();
      });
    });

    // Resize: a corner handle inside the pane.
    const handle = document.createElement('div');
    handle.className = 'dialog-resize-handle';
    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) {
        return;
      }
      const rect = pane.getBoundingClientRect();
      const x0 = tx;
      const y0 = ty;
      drag(e, (dx, dy) => {
        const maxW = window.innerWidth - 2 * MARGIN;
        const maxH = window.innerHeight - 2 * MARGIN;
        const w = Math.min(maxW, Math.max(MIN_WIDTH, rect.width + dx));
        const h = Math.min(maxH, Math.max(MIN_HEIGHT, rect.height + dy));
        pane.style.width = `${w}px`;
        pane.style.height = `${h}px`;
        tx = x0 + (w - rect.width) / 2;
        ty = y0 + (h - rect.height) / 2;
        apply();
      });
    });
    pane.appendChild(handle);
  }
}
