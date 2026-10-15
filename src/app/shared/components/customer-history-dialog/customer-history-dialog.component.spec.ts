import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { CustomerHistoryDialogComponent } from './customer-history-dialog.component';
import { CustomerHistoryEvent } from '../../../core/models/customer.model';
import { UserPreferencesService } from '../../../core/services/user-preferences.service';
import { ZonedDatePipe } from '../../pipes/zoned-date.pipe';
import { CustomerService } from '../../../core/services/customer.service';

describe('CustomerHistoryDialogComponent', () => {
  const discovered: CustomerHistoryEvent = {
    id: 'e1',
    eventType: 'Discovered',
    occurredAtUtc: '2026-10-15T06:00:00Z',
    previousStatus: null,
    newStatus: 'Discovered',
    reason: 'Found by lead discovery.',
    executionId: 'x1',
    campaignId: null,
    correlationId: null,
    providerReference: null,
  };

  function create(history$: ReturnType<CustomerService['getHistory']>): ComponentFixture<CustomerHistoryDialogComponent> {
    TestBed.configureTestingModule({
      declarations: [CustomerHistoryDialogComponent, ZonedDatePipe],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { customerId: 'c1', displayName: 'Asha' } },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: CustomerService, useValue: { getHistory: () => history$ } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(CustomerHistoryDialogComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('lists the events with readable names', () => {
    const fixture = create(of([discovered]));
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Customer discovered');
    expect(text).toContain('Found by lead discovery.');
    expect(text).toContain('Discovery batch x1');
  });

  it('says so when there is no history', () => {
    const fixture = create(of([]));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No history recorded yet');
  });

  it('shows a failure instead of an empty timeline when the request fails', () => {
    const fixture = create(throwError(() => new Error('boom')));
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('could not be loaded');
    expect(text).not.toContain('No history recorded yet');
  });

  it('shows a history it was given without asking the API', () => {
    const getHistory = jasmine.createSpy('getHistory');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      declarations: [CustomerHistoryDialogComponent, ZonedDatePipe],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { displayName: 'Eye clinic 3', events: [discovered] } },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: CustomerService, useValue: { getHistory } },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
    const fixture = TestBed.createComponent(CustomerHistoryDialogComponent);
    fixture.detectChanges();

    expect(getHistory).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Customer discovered');
  });

  it('shows each time in the timezone the user chose, not the browser one', () => {
    create(of([discovered]));   // configures the module; 06:00 UTC
    const preferences = TestBed.inject(UserPreferencesService);
    preferences.setTimezone('Asia/Kolkata');
    try {
      const fixture = TestBed.createComponent(CustomerHistoryDialogComponent);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('11:30');
    } finally {
      preferences.clear();
    }
  });
});
