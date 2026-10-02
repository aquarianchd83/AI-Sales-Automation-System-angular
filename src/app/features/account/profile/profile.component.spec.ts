import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { UserProfile } from '../../../core/models/account.model';
import { AccountRecoveryService } from '../../../core/services/account-recovery.service';
import { AccountService } from '../../../core/services/account.service';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { SharedModule } from '../../../shared/shared.module';
import { ProfileComponent } from './profile.component';

const profile: UserProfile = {
  id: 'u1',
  fullName: 'Platform Operator',
  email: 'platformadmin@example.com',
  phoneNumber: null,
  timezone: 'Asia/Kolkata',
  countryCode: 'IN',
  roles: ['PlatformSuperAdmin'],
  isPlatformSuperAdmin: true,
  tenantId: null,
  createdAt: '2026-01-05T10:00:00Z',
  lastLoginAt: '2026-09-17T06:00:00Z',
};

describe('ProfileComponent', () => {
  let fixture: ComponentFixture<ProfileComponent>;
  let component: ProfileComponent;
  let account: jasmine.SpyObj<AccountService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let recovery: jasmine.SpyObj<AccountRecoveryService>;

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  function create(): void {
    fixture = TestBed.createComponent(ProfileComponent);
    component = fixture.componentInstance;
    spyOn(component, 'reloadApp');
    fixture.detectChanges();
  }

  beforeEach(() => {
    account = jasmine.createSpyObj('AccountService', ['getProfile', 'updateProfile']);
    account.getProfile.and.returnValue(of(profile));
    account.updateProfile.and.callFake((request) => of({ ...profile, ...request }));
    notify = jasmine.createSpyObj('NotificationService', ['success']);
    recovery = jasmine.createSpyObj('AccountRecoveryService', ['sendPhoneCode', 'verifyPhone']);
    recovery.sendPhoneCode.and.returnValue(of(undefined));
    recovery.verifyPhone.and.returnValue(of(undefined));
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    dialog.open.and.returnValue({ afterClosed: () => of(true) } as never);

    TestBed.configureTestingModule({
      declarations: [ProfileComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AccountService, useValue: account },
        { provide: AccountRecoveryService, useValue: recovery },
        { provide: NotificationService, useValue: notify },
        {
          provide: TimeZoneService,
          useValue: {
            getTimezones: () =>
              of([
                { id: 'Asia/Kolkata', displayName: 'India (Kolkata)', utcOffset: '+05:30' },
                { id: 'Europe/London', displayName: 'London', utcOffset: '+00:00' },
              ]),
          },
        },
        {
          provide: BillingService,
          useValue: {
            getRegions: () => of([{ countryCode: 'IN', countryName: 'India', currencyCode: 'INR', currencySymbol: '₹' }]),
          },
        },
      ],
    });
    TestBed.overrideProvider(MatDialog, { useValue: dialog });
  });

  it('loads the profile, including the read-only account facts', () => {
    create();

    expect(component.form.controls.fullName.value).toBe('Platform Operator');
    expect(component.form.controls.timezone.value).toBe('Asia/Kolkata');
    expect(text()).toContain('PlatformSuperAdmin');
    expect(text()).toContain('Platform operator');
  });

  it('saves the editable fields, clearing a blank phone rather than sending an empty string', () => {
    create();

    component.form.controls.fullName.setValue('  Renamed Operator  ');
    component.save();

    expect(account.updateProfile).toHaveBeenCalledWith({
      fullName: 'Renamed Operator',
      email: 'platformadmin@example.com',
      phoneNumber: null,
      timezone: 'Asia/Kolkata',
      countryCode: 'IN',
    });
    expect(notify.success).toHaveBeenCalled();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(component.reloadApp).not.toHaveBeenCalled();
  });

  it('reloads the app after a timezone change so rendered timestamps redraw', () => {
    create();

    component.form.controls.timezone.setValue('Europe/London');
    component.save();

    expect(component.reloadApp).toHaveBeenCalled();
  });

  it('confirms before changing the sign-in email, and does not save when declined', () => {
    create();
    dialog.open.and.returnValue({ afterClosed: () => of(false) } as never);

    component.form.controls.email.setValue('new.address@example.com');
    component.save();

    expect(dialog.open).toHaveBeenCalled();
    expect(account.updateProfile).not.toHaveBeenCalled();
  });

  it('does not save an invalid form', () => {
    create();

    component.form.controls.email.setValue('not-an-email');
    component.save();

    expect(account.updateProfile).not.toHaveBeenCalled();
  });
  describe('phone verification', () => {
    const withPhone = (confirmed: boolean): UserProfile => ({ ...profile, phoneNumber: '+919876543210', phoneNumberConfirmed: confirmed });

    it('offers nothing when there is no phone number', () => {
      create();

      expect(component.canVerifyPhone).toBeFalse();
      expect(component.phoneVerified).toBeFalse();
    });

    it('shows a verified number as verified', () => {
      account.getProfile.and.returnValue(of(withPhone(true)));
      create();

      expect(component.phoneVerified).toBeTrue();
      expect(text()).toContain('Phone verified');
    });

    it('texts a code for an unverified number and then shows the code box', () => {
      account.getProfile.and.returnValue(of(withPhone(false)));
      create();

      component.sendPhoneCode();
      fixture.detectChanges();

      expect(recovery.sendPhoneCode).toHaveBeenCalledTimes(1);
      expect(component.codeSent).toBeTrue();
      expect(text()).toContain('Six-digit code');
    });

    it('waits for a save before verifying a number that was just edited', () => {
      account.getProfile.and.returnValue(of(withPhone(false)));
      create();

      component.form.controls.phoneNumber.setValue('+911111111111');

      expect(component.canVerifyPhone).toBeFalse();
      component.sendPhoneCode();
      expect(recovery.sendPhoneCode).not.toHaveBeenCalled();
    });

    it('verifies with the six digits and then reloads the profile', () => {
      account.getProfile.and.returnValues(of(withPhone(false)), of(withPhone(true)));
      create();
      component.sendPhoneCode();

      component.phoneCode.setValue('12');
      component.verifyPhoneCode();
      expect(recovery.verifyPhone).not.toHaveBeenCalled();

      component.phoneCode.setValue('482913');
      component.verifyPhoneCode();

      expect(recovery.verifyPhone).toHaveBeenCalledWith('482913');
      expect(component.phoneVerified).toBeTrue();
      expect(component.codeSent).toBeFalse();
      expect(notify.success).toHaveBeenCalledWith('Phone number verified.');
    });
  });
});
