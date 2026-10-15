import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { CampaignRetireDialogComponent } from './campaign-retire-dialog.component';
import { Campaign } from '../../../core/models/campaign.model';
import { CampaignService } from '../../../core/services/campaign.service';
import { NotificationService } from '../../../core/services/notification.service';

describe('CampaignRetireDialogComponent', () => {
  const campaign = { id: 'c1', name: 'Eye clinic', status: 'Draft' } as Campaign;
  let fixture: ComponentFixture<CampaignRetireDialogComponent>;
  let retire: jasmine.Spy;
  let close: jasmine.Spy;

  beforeEach(() => {
    retire = jasmine.createSpy('retire').and.returnValue(of({ ...campaign, retiredReason: 'x' }));
    close = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      declarations: [CampaignRetireDialogComponent],
      imports: [ReactiveFormsModule],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { campaign } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: CampaignService, useValue: { retire } },
        { provide: NotificationService, useValue: { success: jasmine.createSpy('success') } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(CampaignRetireDialogComponent);
    fixture.detectChanges();
  });

  it('does not retire without a reason', () => {
    fixture.componentInstance.form.controls.reason.setValue('   ');
    fixture.componentInstance.retire();
    expect(retire).not.toHaveBeenCalled();
  });

  it('sends the trimmed reason and closes with the updated campaign', () => {
    fixture.componentInstance.form.controls.reason.setValue('  Wrong audience ');
    fixture.componentInstance.retire();
    expect(retire).toHaveBeenCalledWith('c1', 'Wrong audience');
    expect(close).toHaveBeenCalled();
  });
});
