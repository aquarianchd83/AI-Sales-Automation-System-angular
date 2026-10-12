import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { TenantSettingCategory } from '../../../core/models/tenant-settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformTenantConfigService } from '../../../core/services/platform-tenant-config.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformTenantConfigOverridesDialogComponent } from './platform-tenant-config-overrides-dialog.component';

const CATEGORIES: TenantSettingCategory[] = [
  {
    category: 'ContentStudio',
    items: [
      {
        key: 'ContentStudio:Enabled',
        category: 'ContentStudio',
        isList: false,
        description: 'Turns the studio on.',
        globalValue: 'false',
        overrideValue: null,
        effectiveValue: 'false',
        options: ['true', 'false'],
      },
      {
        key: 'ContentStudio:StorageKeyPrefix',
        category: 'ContentStudio',
        isList: false,
        description: null,
        globalValue: 'studio',
        overrideValue: null,
        effectiveValue: 'studio',
      },
    ],
  },
];

describe('PlatformTenantConfigOverridesDialogComponent', () => {
  let fixture: ComponentFixture<PlatformTenantConfigOverridesDialogComponent>;
  let save: jasmine.Spy;

  function render(): HTMLElement {
    save = jasmine.createSpy('saveOverrides').and.returnValue(of(CATEGORIES));
    TestBed.configureTestingModule({
      declarations: [PlatformTenantConfigOverridesDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformTenantConfigService, useValue: { saveOverrides: save } },
        { provide: NotificationService, useValue: { success: jasmine.createSpy(), info: jasmine.createSpy() } },
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MAT_DIALOG_DATA, useValue: { tenantId: 't1', tenantName: 'Trilok Eye Care', categories: CATEGORIES } },
      ],
    });
    fixture = TestBed.createComponent(PlatformTenantConfigOverridesDialogComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers a dropdown for a setting with fixed choices and a text box for one without', () => {
    const el = render();

    expect(el.querySelectorAll('mat-select').length).toBe(1);
    expect(el.querySelectorAll('input').length).toBe(1);
  });

  it('starts a dropdown on "use the platform default" when the tenant has no override', () => {
    const el = render();

    expect(fixture.componentInstance.form.controls['ContentStudio:Enabled'].value).toBe('');
    expect(el.querySelector('mat-select')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('shows what the platform default is in the hint', () => {
    const el = render();

    expect(el.textContent).toContain('Platform default: false');
    expect(el.textContent).toContain('Platform default: studio');
  });
});
