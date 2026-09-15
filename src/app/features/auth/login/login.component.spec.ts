import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { LoginComponent, REMEMBERED_EMAIL_KEY } from './login.component';

describe('LoginComponent remember me', () => {
  let auth: jasmine.SpyObj<AuthService>;

  function create(): LoginComponent {
    TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
      ],
    });
    // The test router has no /dashboard route; only the storage side effects matter here.
    spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    auth = jasmine.createSpyObj('AuthService', ['login']);
    auth.login.and.returnValue(of({ fullName: 'Ada', email: 'ada@example.com', roles: ['Admin'] } as User));
  });

  afterEach(() => localStorage.removeItem(REMEMBERED_EMAIL_KEY));

  it('starts empty and unchecked when nothing is remembered', () => {
    const component = create();

    expect(component.form.getRawValue()).toEqual({ email: '', password: '', rememberMe: false });
  });

  it('pre-fills the remembered email and checks the box', () => {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, 'ada@example.com');

    const component = create();

    expect(component.form.controls.email.value).toBe('ada@example.com');
    expect(component.form.controls.rememberMe.value).toBeTrue();
    expect(component.form.controls.password.value).toBe('');
  });

  it('remembers only the email after a successful login, and never sends rememberMe to the API', () => {
    const component = create();
    component.form.setValue({ email: 'ada@example.com', password: 'secret', rememberMe: true });

    component.submit();

    expect(auth.login).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'secret' });
    expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBe('ada@example.com');
  });

  it('forgets a previously remembered email when the box is unchecked', () => {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, 'ada@example.com');
    const component = create();
    component.form.patchValue({ password: 'secret', rememberMe: false });

    component.submit();

    expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBeNull();
  });

  it('does not remember anything when login fails', () => {
    auth.login.and.returnValue(throwError(() => ({ status: 401 })));
    const component = create();
    component.form.setValue({ email: 'typo@example.com', password: 'wrong', rememberMe: true });

    component.submit();

    expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBeNull();
  });
});
