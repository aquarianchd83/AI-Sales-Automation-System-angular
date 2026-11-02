import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { UserProfile } from '../../../core/models/account.model';
import { AccountService } from '../../../core/services/account.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { SharedModule } from '../../../shared/shared.module';
import { AccountProfileComponent } from './account-profile.component';

const profile = (over: Partial<UserProfile> = {}): UserProfile => ({
  id: 'u1',
  fullName: 'Harish',
  email: 'owner@platform.test',
  phoneNumber: null,
  timezone: 'Asia/Kolkata',
  countryCode: 'IN',
  roles: ['PlatformSuperAdmin'],
  isPlatformSuperAdmin: true,
  tenantId: null,
  createdAt: '2026-01-01T00:00:00Z',
  lastLoginAt: null,
  ...over,
});

describe('AccountProfileComponent', () => {
  let fixture: ComponentFixture<AccountProfileComponent>;
  let account: jasmine.SpyObj<AccountService>;
  let auth: jasmine.SpyObj<AuthService>;

  function create(productOwner: boolean, p: UserProfile = profile()): AccountProfileComponent {
    auth.hasAnyRole.and.returnValue(productOwner);
    account.getProfile.and.returnValue(of(p));
    fixture = TestBed.createComponent(AccountProfileComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(async () => {
    account = jasmine.createSpyObj('AccountService', ['getProfile', 'updateProfile']);
    auth = jasmine.createSpyObj('AuthService', ['hasAnyRole', 'patchCurrentUser']);
    const zones = jasmine.createSpyObj('TimeZoneService', ['getTimezones']);
    zones.getTimezones.and.returnValue(of([{ id: 'Asia/Kolkata', displayName: 'India', utcOffset: '+05:30' }]));
    await TestBed.configureTestingModule({
      declarations: [AccountProfileComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AccountService, useValue: account },
        { provide: AuthService, useValue: auth },
        { provide: TimeZoneService, useValue: zones },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success']) },
      ],
    }).compileComponents();
  });

  it('asks the product owner for a WhatsApp number with a country code', () => {
    const component = create(true);
    expect(fixture.nativeElement.textContent).toContain('WhatsApp number for urgent alerts');

    component.form.controls.phoneNumber.setValue('9876543210');
    expect(component.form.controls.phoneNumber.hasError('pattern')).toBeTrue();

    component.form.controls.phoneNumber.setValue('+91 98765 43210');
    expect(component.form.controls.phoneNumber.valid).toBeTrue();
  });

  it('does not insist on a country code for anyone else', () => {
    const component = create(false, profile({ roles: ['Admin'], isPlatformSuperAdmin: false }));

    component.form.controls.phoneNumber.setValue('9876543210');

    expect(component.form.controls.phoneNumber.valid).toBeTrue();
  });

  it('saves every field, sending the unedited country back so it is not cleared', () => {
    const component = create(true);
    account.updateProfile.and.returnValue(of(profile({ phoneNumber: '+919876543210' })));

    component.form.controls.phoneNumber.setValue('+919876543210');
    component.save();

    expect(account.updateProfile).toHaveBeenCalledWith({
      fullName: 'Harish',
      email: 'owner@platform.test',
      phoneNumber: '+919876543210',
      timezone: 'Asia/Kolkata',
      countryCode: 'IN',
      notificationEmail: null,
    });
  });

  it('lets the product owner name the email platform alerts go to, apart from the sign-in address', () => {
    const component = create(true, profile({ notificationEmail: 'alerts@platform.test' }));
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=notification-email]')).not.toBeNull();
    expect(component.form.controls.notificationEmail.value).toBe('alerts@platform.test');
    account.updateProfile.and.returnValue(of(profile({ notificationEmail: 'ops@platform.test' })));

    component.form.controls.notificationEmail.setValue('ops@platform.test');
    component.save();

    expect(account.updateProfile).toHaveBeenCalledWith(jasmine.objectContaining({ email: 'owner@platform.test', notificationEmail: 'ops@platform.test' }));
  });

  it('clears the alert email when the box is emptied, and refuses one that is not an address', () => {
    const component = create(true, profile({ notificationEmail: 'alerts@platform.test' }));
    account.updateProfile.and.returnValue(of(profile()));

    component.form.controls.notificationEmail.setValue('not-an-email');
    expect(component.form.controls.notificationEmail.hasError('email')).toBeTrue();
    component.save();
    expect(account.updateProfile).not.toHaveBeenCalled();

    component.form.controls.notificationEmail.setValue('');
    component.save();
    expect(account.updateProfile).toHaveBeenCalledWith(jasmine.objectContaining({ notificationEmail: null }));
  });

  it('does not show the alert email to anyone but the product owner, and sends their current value back untouched', () => {
    const component = create(false, profile({ roles: ['Admin'], isPlatformSuperAdmin: false, notificationEmail: 'keep@tenant.test' }));
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid=notification-email]')).toBeNull();
    account.updateProfile.and.returnValue(of(profile()));

    component.form.controls.fullName.setValue('Renamed');
    component.save();

    expect(account.updateProfile).toHaveBeenCalledWith(jasmine.objectContaining({ fullName: 'Renamed', notificationEmail: 'keep@tenant.test' }));
  });
});
