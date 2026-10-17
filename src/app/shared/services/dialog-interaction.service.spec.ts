import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { DialogInteractionService } from './dialog-interaction.service';

@Component({ template: '<h2 mat-dialog-title>Title</h2><mat-dialog-content>Body</mat-dialog-content>' })
class HostDialogComponent {}

describe('DialogInteractionService', () => {
  let dialog: MatDialog;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [HostDialogComponent],
      imports: [MatDialogModule, NoopAnimationsModule],
    });
    TestBed.inject(DialogInteractionService).init();
    dialog = TestBed.inject(MatDialog);
  });

  afterEach(() => dialog.closeAll());

  it('opens every dialog at 80% of the screen whatever width the caller asked for', () => {
    dialog.open(HostDialogComponent, { width: '440px' });
    const pane = document.querySelector<HTMLElement>('.cdk-overlay-pane')!;

    expect(pane.style.width).toBe('80vw');
    expect(pane.style.height).toBe('80vh');
  });
});
