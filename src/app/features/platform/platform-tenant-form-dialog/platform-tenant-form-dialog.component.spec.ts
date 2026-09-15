import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { PlatformTenantDetail } from '../../../core/models/platform.model';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformTenantService } from '../../../core/services/platform-tenant.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformTenantFormDialogComponent } from './platform-tenant-form-dialog.component';

describe('PlatformTenantFormDialogComponent', () => {
  let fixture: ComponentFixture<PlatformTenantFormDialogComponent>;
  let component: PlatformTenantFormDialogComponent;
  let tenants: jasmine.SpyObj<PlatformTenantService>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<PlatformTenantFormDialogComponent>>;

  function fillRequired(): void {
    component.form.patchValue({
      companyName: '  SunVolt Energy ',
      adminFullName: 'Priya Nair',
      adminEmail: 'priya@sunvolt.example.com',
      adminPassword: 'Temp#12345',
    });
  }

  beforeEach(() => {
    tenants = jasmine.createSpyObj('PlatformTenantService', ['create']);
    tenants.create.and.returnValue(of({ id: 't1', name: 'SunVolt Energy' } as PlatformTenantDetail));
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    TestBed.configureTestingModule({
      declarations: [PlatformTenantFormDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformTenantService, useValue: tenants },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success']) },
        {
          provide: TimeZoneService,
          useValue: { getTimezones: () => of([{ id: 'Asia/Dubai', displayName: 'Dubai', utcOffset: '+04:00' }]) },
        },
        {
          provide: BillingService,
          useValue: { getRegions: () => of([{ countryCode: 'AE', countryName: 'UAE', currencyCode: 'AED', currencySymbol: 'د.إ' }]) },
        },
      ],
    });

    fixture = TestBed.createComponent(PlatformTenantFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps business details collapsed and optional, sending nulls and no keywords when left blank', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Business details');
    expect(text).toContain('Optional — the tenant can add these later');

    fillRequired();
    component.save();

    expect(tenants.create).toHaveBeenCalledOnceWith({
      companyName: 'SunVolt Energy',
      slug: null,
      adminFullName: 'Priya Nair',
      adminEmail: 'priya@sunvolt.example.com',
      adminPassword: 'Temp#12345',
      countryCode: null,
      timezone: null,
      productName: null,
      industry: null,
      businessDescription: null,
      websiteUrl: null,
      supportEmail: null,
      supportPhone: null,
      domainKeywords: [],
    });
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('sends every business detail and keyword entered', () => {
    fillRequired();
    component.form.patchValue({
      countryCode: 'AE',
      timezone: 'Asia/Dubai',
      productName: ' SunVolt Home Solar ',
      industry: 'Solar & energy',
      businessDescription: 'Rooftop solar for homes.',
      websiteUrl: 'https://sunvolt.example.com',
      supportEmail: 'help@sunvolt.example.com',
      supportPhone: '+971 4 123 4567',
    });
    component.addKeyword({ value: 'solar panels, net metering, Solar Panels', chipInput: { clear: () => undefined } } as never);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('9 added');

    component.save();

    expect(tenants.create).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({
        countryCode: 'AE',
        timezone: 'Asia/Dubai',
        productName: 'SunVolt Home Solar',
        industry: 'Solar & energy',
        businessDescription: 'Rooftop solar for homes.',
        websiteUrl: 'https://sunvolt.example.com',
        supportEmail: 'help@sunvolt.example.com',
        supportPhone: '+971 4 123 4567',
        domainKeywords: ['solar panels', 'net metering'],
      })
    );
  });

  it('opens the business details section when an error is hidden inside it', () => {
    fillRequired();
    component.form.patchValue({ websiteUrl: 'sunvolt dot com' });

    component.save();

    expect(tenants.create).not.toHaveBeenCalled();
    expect(component.detailsExpanded).toBeTrue();
  });
});
