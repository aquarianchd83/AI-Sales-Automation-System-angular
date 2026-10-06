import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { BillingService } from '../../../core/services/billing.service';
import { NotificationService } from '../../../core/services/notification.service';
import { TimeZoneService } from '../../../core/services/timezone.service';
import { AuthModule } from '../auth.module';
import { SignupComponent } from './signup.component';

describe('SignupComponent', () => {
  let fixture: ComponentFixture<SignupComponent>;
  let component: SignupComponent;
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['signUp']);
    auth.signUp.and.returnValue(of({ fullName: 'Asha' } as unknown as User));
    TestBed.configureTestingModule({
      imports: [AuthModule, HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: BillingService, useValue: { getRegions: () => of([{ countryCode: 'IN', countryName: 'India', currencyCode: 'INR' }]) } },
        { provide: TimeZoneService, useValue: { getTimezones: () => of([]) } },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
      ],
    });
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(SignupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const fill = (country: string): void =>
    component.form.patchValue({ companyName: 'Confianza', fullName: 'Asha', email: 'asha@example.com', password: 'Passw0rd!', country });

  it('will not register without a country, and says so next to the field', () => {
    fill('');

    component.submit();
    fixture.detectChanges();

    expect(auth.signUp).not.toHaveBeenCalled();
    expect(component.form.controls.country.hasError('required')).toBeTrue();
    expect(component.form.controls.country.touched).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelector('mat-select')!.getAttribute('aria-required')).toBe('true');
  });

  it('sends the chosen country with the registration', () => {
    fill('IN');

    component.submit();

    expect(auth.signUp).toHaveBeenCalledOnceWith(jasmine.objectContaining({ email: 'asha@example.com', countryCode: 'IN' }));
  });
});
