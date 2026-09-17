import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { BehaviorSubject, of } from 'rxjs';

import { DiscoveredLead } from '../../../core/models/lead-discovery.model';
import { AuthService } from '../../../core/services/auth.service';
import { LeadDiscoveryService } from '../../../core/services/lead-discovery.service';
import { SharedModule } from '../../../shared/shared.module';
import { DiscoveredLeadListComponent } from './discovered-lead-list.component';

const lead: DiscoveredLead = {
  id: 'l1',
  businessName: 'Clear Sight Eye Clinic',
  businessType: 'Eye clinic',
  contactPerson: 'Dr. Mehta',
  address: 'SCO 12',
  city: 'Chandigarh',
  state: 'Punjab',
  phone: '+91 172 400 1234',
  email: 'hello@clearsight.example',
  website: 'https://clearsight.example',
  sourceUrl: 'https://directory.example/clear-sight',
  phoneVerified: true,
  phoneSourceUrl: 'https://clearsight.example/contact',
  qualificationStatus: 'Qualified',
  customerId: 'c1',
  leadScore: 84,
  scoreRationale: 'Independent clinic in the target city.',
  discoveredAt: '2026-09-15T02:10:00Z',
};

describe('DiscoveredLeadListComponent', () => {
  let fixture: ComponentFixture<DiscoveredLeadListComponent>;
  let component: DiscoveredLeadListComponent;
  let service: jasmine.SpyObj<LeadDiscoveryService>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let roles: string[];

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(items: DiscoveredLead[]): void {
    service.getLeads.and.returnValue(of({ items, totalCount: items.length, page: 1, pageSize: 25, totalPages: 1 }));
    fixture = TestBed.createComponent(DiscoveredLeadListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    roles = ['Admin'];
    service = jasmine.createSpyObj('LeadDiscoveryService', ['getLeads']);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    TestBed.configureTestingModule({
      declarations: [DiscoveredLeadListComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: LeadDiscoveryService, useValue: service },
        {
          provide: AuthService,
          useValue: {
            currentUser$: new BehaviorSubject({ roles }),
            hasAnyRole: (wanted: string[]) => wanted.length === 0 || wanted.some((role) => roles.includes(role)),
          },
        },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: dialog });
  });

  it('lists discovered leads with contact and score', () => {
    create([lead]);

    expect(service.getLeads).toHaveBeenCalledWith({ page: 1, pageSize: 25 }, null);
    expect(text()).toContain('Clear Sight Eye Clinic');
    expect(text()).toContain('Chandigarh, Punjab');
    expect(text()).toContain('+91 172 400 1234');
    expect(text()).toContain('84');
    expect(text()).toContain('Discovery profile');
  });

  it('filters by minimum score from the first page', fakeAsync(() => {
    create([lead]);

    component.minScoreControl.setValue(80);
    tick();

    expect(service.getLeads).toHaveBeenCalledWith({ page: 1, pageSize: 25 }, 80);
  }));

  it('opens the detail dialog for a row', () => {
    create([lead]);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('tr.clickable-row')!.click();

    expect(dialog.open).toHaveBeenCalledWith(jasmine.any(Function), jasmine.objectContaining({ data: lead }));
  });

  it('hides the profile link from a sales agent', () => {
    roles = ['SalesAgent'];
    create([]);

    expect(text()).toContain('No leads discovered yet.');
    expect(text()).not.toContain('Discovery profile');
    expect(text()).not.toContain('Set up your discovery profile');
  });
});
