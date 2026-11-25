import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import {
  SimulatorDataCategory,
  SimulatorDummyData,
  SimulatorDummyRecord,
  SimulatorLeadVariant,
} from '../../../core/models/simulator-data.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SimulatorDataService } from '../../../core/services/simulator-data.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformSimulatorDataComponent } from './platform-simulator-data.component';

function row(partial: Partial<SimulatorDummyRecord>): SimulatorDummyRecord {
  return {
    id: 'id-' + Math.random(),
    category: SimulatorDataCategory.LeadBusiness,
    name: 'Sharma Dental Care',
    value: null,
    businessType: 'Dental clinic',
    contactPerson: 'Dr. Rakesh',
    address: 'SCO 12',
    city: null,
    phone: '+91 98140 21001',
    email: 'hello@sharma.example',
    website: 'https://sharma.example',
    leadScore: 86,
    variant: SimulatorLeadVariant.Qualified,
    isActive: true,
    displayOrder: 10,
    createdAt: '2026-11-25T10:00:00',
    updatedAt: null,
    ...partial,
  };
}

describe('PlatformSimulatorDataComponent', () => {
  const data: SimulatorDummyData = {
    records: [
      row({ name: 'Sharma Dental Care' }),
      row({ name: 'Closed Down Salon', variant: SimulatorLeadVariant.PermanentlyClosed }),
      row({ category: SimulatorDataCategory.AiReply, name: 'Default', value: 'Namaste!', variant: null }),
    ],
    keys: [
      { category: SimulatorDataCategory.AiReply, key: 'Default', defaultValue: 'Thanks', help: 'Reply for everything else.' },
      { category: SimulatorDataCategory.AiReply, key: 'Escalation', defaultValue: 'Connecting you', help: 'Escalation.' },
      { category: SimulatorDataCategory.Setting, key: 'UniquePerRun', defaultValue: 'true', help: 'Switch.' },
    ],
  };

  let service: jasmine.SpyObj<SimulatorDataService>;
  let dialog: { open: jasmine.Spy };

  function render() {
    service = jasmine.createSpyObj<SimulatorDataService>('SimulatorDataService', ['getAll', 'delete', 'restoreDefaults']);
    service.getAll.and.returnValue(of(data));
    service.delete.and.returnValue(of(undefined));
    service.restoreDefaults.and.returnValue(of({ added: 2 }));
    dialog = { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(true) }) };

    TestBed.configureTestingModule({
      declarations: [PlatformSimulatorDataComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: SimulatorDataService, useValue: service },
        { provide: MatDialog, useValue: dialog },
        { provide: NotificationService, useValue: { success: () => undefined } },
      ],
    });
    const fixture = TestBed.createComponent(PlatformSimulatorDataComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
  }

  it('lists the lead businesses with how each behaves', () => {
    const { root } = render();

    const text = root.textContent ?? '';
    expect(text).toContain('Sharma Dental Care');
    expect(text).toContain('Permanently closed (rejected)');
    expect(text).toContain('Lead businesses (2)');
  });

  it('offers only the keys that have no row yet when adding a keyed value', () => {
    const { component } = render();

    expect(component.freeKeys(SimulatorDataCategory.AiReply).map((k) => k.key)).toEqual(['Escalation']);
    expect(component.canAdd(SimulatorDataCategory.AiReply)).toBeTrue();
  });

  it('deletes a row after confirmation and reloads', () => {
    const { component } = render();

    component.delete(data.records[0]);

    expect(service.delete).toHaveBeenCalledWith(data.records[0].id);
    expect(service.getAll).toHaveBeenCalledTimes(2);
  });

  it('restores the starter rows', () => {
    const { component } = render();

    component.restoreDefaults();

    expect(service.restoreDefaults).toHaveBeenCalled();
  });
});
