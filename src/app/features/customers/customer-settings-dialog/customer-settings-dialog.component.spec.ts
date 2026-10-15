import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { of } from 'rxjs';

import { CustomerSettingsDialogComponent } from './customer-settings-dialog.component';
import { CustomerService } from '../../../core/services/customer.service';
import { NotificationService } from '../../../core/services/notification.service';

describe('CustomerSettingsDialogComponent', () => {
  let fixture: ComponentFixture<CustomerSettingsDialogComponent>;
  let component: CustomerSettingsDialogComponent;
  let setConsentSetting: jasmine.Spy;
  let close: jasmine.Spy;

  function create(consentRequired: boolean): void {
    setConsentSetting = jasmine.createSpy('setConsentSetting').and.callFake((v: boolean) => of({ consentRequired: v }));
    close = jasmine.createSpy('close');
    TestBed.configureTestingModule({
      declarations: [CustomerSettingsDialogComponent],
      imports: [FormsModule, MatSlideToggleModule],
      providers: [
        { provide: CustomerService, useValue: { getConsentSetting: () => of({ consentRequired }), setConsentSetting } },
        { provide: NotificationService, useValue: { success: jasmine.createSpy('success') } },
        { provide: MatDialogRef, useValue: { close } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(CustomerSettingsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loads the current setting and says which status new customers get', () => {
    create(false);
    expect(component.consentRequired).toBeFalse();
    expect(component.newCustomerStatus).toBe('Pending opt-in');

    TestBed.resetTestingModule();
    create(true);
    expect(component.consentRequired).toBeTrue();
    expect(component.newCustomerStatus).toBe('Waiting for consent');
  });

  it('saves the chosen setting and closes', () => {
    create(false);
    component.consentRequired = true;
    component.save();

    expect(setConsentSetting).toHaveBeenCalledWith(true);
    expect(close).toHaveBeenCalledWith(true);
  });
});
