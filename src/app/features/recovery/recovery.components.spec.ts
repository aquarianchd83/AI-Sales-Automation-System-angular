import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { AccountRecoveryService } from '../../core/services/account-recovery.service';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { SharedModule } from '../../shared/shared.module';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';
import { VerifyEmailComponent } from './verify-email/verify-email.component';

describe('Sign-in recovery pages', () => {
  let recovery: jasmine.SpyObj<AccountRecoveryService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let auth: { isAuthenticated: boolean; currentUser: { email: string } | null; patchCurrentUser: jasmine.Spy };

  function configure(query: Record<string, string> = {}): void {
    recovery = jasmine.createSpyObj('AccountRecoveryService', ['forgotPassword', 'resetPassword', 'verifyEmail']);
    recovery.forgotPassword.and.returnValue(of(undefined));
    recovery.resetPassword.and.returnValue(of(undefined));
    recovery.verifyEmail.and.returnValue(of(undefined));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    auth = { isAuthenticated: false, currentUser: null, patchCurrentUser: jasmine.createSpy('patchCurrentUser') };

    TestBed.configureTestingModule({
      declarations: [ForgotPasswordComponent, ResetPasswordComponent, VerifyEmailComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AccountRecoveryService, useValue: recovery },
        { provide: NotificationService, useValue: notify },
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
  }

  const text = (fixture: ComponentFixture<unknown>) => (fixture.nativeElement as HTMLElement).textContent ?? '';

  describe('forgot password', () => {
    function create(): { fixture: ComponentFixture<ForgotPasswordComponent>; component: ForgotPasswordComponent } {
      configure();
      const fixture = TestBed.createComponent(ForgotPasswordComponent);
      fixture.detectChanges();
      return { fixture, component: fixture.componentInstance };
    }

    it('will not send for an empty or malformed address', () => {
      const { component } = create();

      component.submit();
      component.form.patchValue({ email: 'not-an-email' });
      component.submit();

      expect(recovery.forgotPassword).not.toHaveBeenCalled();
    });

    it('asks for an emailed link by default and answers the same way whoever the address is', () => {
      const { fixture, component } = create();
      component.form.patchValue({ email: 'ada@example.com' });

      component.submit();
      fixture.detectChanges();

      expect(recovery.forgotPassword).toHaveBeenCalledWith({ email: 'ada@example.com', channel: 'email' });
      expect(text(fixture)).toContain('If there is an account for');
    });

    it('asks for a texted code on request and then offers to enter it', () => {
      const { fixture, component } = create();
      const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
      component.form.patchValue({ email: 'ada@example.com', channel: 'sms' });

      component.submit();
      fixture.detectChanges();
      expect(recovery.forgotPassword).toHaveBeenCalledWith({ email: 'ada@example.com', channel: 'sms' });
      expect(text(fixture)).toContain('verified phone number');

      component.enterCode();
      expect(navigate).toHaveBeenCalledWith(['/recover/reset-password'], { queryParams: { email: 'ada@example.com', channel: 'sms' } });
    });

    it('stays on the form when the request fails', () => {
      const { fixture, component } = create();
      recovery.forgotPassword.and.returnValue(throwError(() => ({ status: 429 })));
      component.form.patchValue({ email: 'ada@example.com' });

      component.submit();
      fixture.detectChanges();

      expect(component.sentVia).toBeNull();
      expect(component.submitting).toBeFalse();
    });
  });

  describe('reset password', () => {
    function create(query: Record<string, string>): { fixture: ComponentFixture<ResetPasswordComponent>; component: ResetPasswordComponent } {
      configure(query);
      // The test router has no /login route; only the hand-off matters here.
      navigateByUrl = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
      const fixture = TestBed.createComponent(ResetPasswordComponent);
      fixture.detectChanges();
      return { fixture, component: fixture.componentInstance };
    }

    let navigateByUrl: jasmine.Spy;
    const GOOD = 'New-Passw0rd!';

    it('says so when the emailed link is missing its token', () => {
      const { fixture, component } = create({ email: 'ada@example.com' });

      expect(component.linkUsable).toBeFalse();
      expect(text(fixture)).toContain('This link is incomplete');
    });

    it('resets with the token from the link and then sends the person to sign in', () => {
      const { component } = create({ email: 'ada@example.com', token: 'tok-1' });
      component.form.patchValue({ newPassword: GOOD, confirmPassword: GOOD });

      component.submit();

      expect(recovery.resetPassword).toHaveBeenCalledWith({ email: 'ada@example.com', token: 'tok-1', newPassword: GOOD, channel: 'email' });
      expect(notify.success).toHaveBeenCalled();
      expect(navigateByUrl).toHaveBeenCalledWith('/login');
    });

    it('needs the six-digit code when the reset came by text message', () => {
      const { component } = create({ email: 'ada@example.com', channel: 'sms' });
      component.form.patchValue({ newPassword: GOOD, confirmPassword: GOOD, code: '12' });

      component.submit();
      expect(recovery.resetPassword).not.toHaveBeenCalled();

      component.form.controls.code.setValue('482913');
      component.submit();
      expect(recovery.resetPassword).toHaveBeenCalledWith({ email: 'ada@example.com', token: '482913', newPassword: GOOD, channel: 'sms' });
    });

    it('refuses a password the rules reject, or two that differ', () => {
      const { component } = create({ email: 'ada@example.com', token: 'tok-1' });

      component.form.patchValue({ newPassword: 'weakpassword', confirmPassword: 'weakpassword' });
      component.submit();
      component.form.patchValue({ newPassword: GOOD, confirmPassword: 'Different-Passw0rd!' });
      component.submit();

      expect(recovery.resetPassword).not.toHaveBeenCalled();
      expect(component.form.hasError('mismatch')).toBeTrue();
    });
  });

  describe('verify email', () => {
    function create(query: Record<string, string>): ComponentFixture<VerifyEmailComponent> {
      configure(query);
      const fixture = TestBed.createComponent(VerifyEmailComponent);
      fixture.detectChanges();
      return fixture;
    }

    it('confirms on arrival and says so', () => {
      const fixture = create({ email: 'ada@example.com', token: 'tok' });

      expect(recovery.verifyEmail).toHaveBeenCalledWith({ email: 'ada@example.com', token: 'tok' });
      expect(fixture.componentInstance.state).toBe('confirmed');
      expect(text(fixture)).toContain('Your email address is confirmed');
    });

    it('clears the banner for the person who is signed in as that address', () => {
      configure({ email: 'ada@example.com', token: 'tok' });
      auth.currentUser = { email: 'Ada@Example.com' };
      TestBed.createComponent(VerifyEmailComponent).detectChanges();

      expect(auth.patchCurrentUser).toHaveBeenCalledWith({ emailConfirmed: true });
    });

    it('does not touch a different signed-in user', () => {
      configure({ email: 'ada@example.com', token: 'tok' });
      auth.currentUser = { email: 'someone-else@example.com' };
      TestBed.createComponent(VerifyEmailComponent).detectChanges();

      expect(auth.patchCurrentUser).not.toHaveBeenCalled();
    });

    it('reports an invalid link without calling the API when parameters are missing', () => {
      const fixture = create({ email: 'ada@example.com' });

      expect(recovery.verifyEmail).not.toHaveBeenCalled();
      expect(fixture.componentInstance.state).toBe('failed');
    });

    it('reports a link the API rejects', () => {
      configure({ email: 'ada@example.com', token: 'bad' });
      recovery.verifyEmail.and.returnValue(throwError(() => ({ status: 400 })));
      const fixture = TestBed.createComponent(VerifyEmailComponent);
      fixture.detectChanges();

      expect(fixture.componentInstance.state).toBe('failed');
      expect(text(fixture)).toContain('invalid or has expired');
    });
  });
});
