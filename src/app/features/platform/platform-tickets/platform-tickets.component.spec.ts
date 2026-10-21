import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { PlatformTicket } from '../../../core/models/platform.model';
import { PlatformTicketService } from '../../../core/services/platform-ticket.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformTicketsComponent } from './platform-tickets.component';

const ticket = (over: Partial<PlatformTicket> = {}): PlatformTicket => ({
  id: 't1',
  tenantId: 'a',
  tenantName: 'Acme Traders',
  kind: 'SimulatedAiConfiguration',
  subject: 'URGENT: AI provider is set to Simulated',
  description: 'Acme Traders used the test chat.',
  priority: 'Urgent',
  status: 'Open',
  deliveryNote: 'in-app: sent; whatsapp: sent to 1',
  createdAt: '2026-10-21T08:00:00Z',
  resolvedAtUtc: null,
  ...over,
});

describe('PlatformTicketsComponent', () => {
  let fixture: ComponentFixture<PlatformTicketsComponent>;
  let service: jasmine.SpyObj<PlatformTicketService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    service = jasmine.createSpyObj('PlatformTicketService', ['getAll', 'setStatus']);
    service.getAll.and.returnValue(of([ticket()]));
    await TestBed.configureTestingModule({
      declarations: [PlatformTicketsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: PlatformTicketService, useValue: service }],
    }).compileComponents();

    fixture = TestBed.createComponent(PlatformTicketsComponent);
    fixture.detectChanges();
  });

  it('lists the urgent ticket with who reported it and how the owner was alerted', () => {
    expect(text()).toContain('URGENT: AI provider is set to Simulated');
    expect(text()).toContain('Urgent');
    expect(text()).toContain('Acme Traders');
    expect(text()).toContain('whatsapp: sent to 1');
  });

  it('marks a ticket resolved and reloads the list', () => {
    service.setStatus.and.returnValue(of(ticket({ status: 'Resolved' })));

    fixture.componentInstance.setStatus(fixture.componentInstance.tickets[0], 'Resolved');

    expect(service.setStatus).toHaveBeenCalledWith('t1', 'Resolved');
    expect(service.getAll).toHaveBeenCalledTimes(2);
  });

  it('narrows the list by status', () => {
    fixture.componentInstance.setFilter('Resolved');

    expect(service.getAll).toHaveBeenCalledWith('Resolved');
  });
});
