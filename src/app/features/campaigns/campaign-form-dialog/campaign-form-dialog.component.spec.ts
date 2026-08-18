import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { OverlayContainer } from '@angular/cdk/overlay';

import { CampaignFormDialogComponent, CampaignFormDialogData } from './campaign-form-dialog.component';
import { SharedModule } from '../../../shared/shared.module';

describe('CampaignFormDialogComponent', () => {
  let fixture: ComponentFixture<CampaignFormDialogComponent>;
  let overlayContainer: OverlayContainer;

  afterEach(() => {
    // The datepicker's calendar overlay attaches to document.body, not this fixture -
    // left uncleaned it would still be there for the next spec file's queries.
    overlayContainer.ngOnDestroy();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CampaignFormDialogComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { mode: 'create' } as CampaignFormDialogData },
        { provide: MatDialogRef, useValue: { close: () => undefined } },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(CampaignFormDialogComponent);
    fixture.detectChanges();
  });

  it('opens the calendar overlay when the datepicker toggle is clicked', () => {
    const toggle: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '.date-field .mat-datepicker-toggle button'
    );
    expect(toggle).withContext('toggle button should render').toBeTruthy();

    toggle!.click();
    fixture.detectChanges();

    const calendar = document.querySelector('.mat-datepicker-content');
    expect(calendar).withContext('calendar overlay should appear after clicking the toggle').toBeTruthy();
  });

  it('does not throw during construction/render (create mode)', () => {
    // If field-initializer order or a null dereference were broken, this would already
    // have thrown before reaching the test body above — this just makes the assertion explicit.
    expect(fixture.componentInstance).toBeTruthy();
  });
});

describe('CampaignFormDialogComponent (edit mode, existing scheduled date)', () => {
  let fixture: ComponentFixture<CampaignFormDialogComponent>;
  let overlayContainer: OverlayContainer;

  afterEach(() => {
    overlayContainer.ngOnDestroy();
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CampaignFormDialogComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            mode: 'edit',
            campaign: {
              id: '1',
              name: 'Test',
              description: null,
              status: 'Draft',
              scheduledStartAt: '2026-08-20T09:30:00',
              createdBy: '1',
              startedAt: null,
              stoppedAt: null,
              audienceCount: 0,
              steps: [],
              createdAt: '2026-08-01T00:00:00',
            },
          } as CampaignFormDialogData,
        },
        { provide: MatDialogRef, useValue: { close: () => undefined } },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(CampaignFormDialogComponent);
    fixture.detectChanges();
  });

  it('pre-fills the time field from the existing scheduledStartAt and opens the calendar on toggle click', () => {
    const timeInput: HTMLInputElement = fixture.nativeElement.querySelector('.time-field input[type="time"]');
    expect(timeInput.value).toBe('09:30');

    const toggle: HTMLButtonElement | null = fixture.nativeElement.querySelector(
      '.date-field .mat-datepicker-toggle button'
    );
    toggle!.click();
    fixture.detectChanges();

    expect(document.querySelector('.mat-datepicker-content')).toBeTruthy();
  });
});
