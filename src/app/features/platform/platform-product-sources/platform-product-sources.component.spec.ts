import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { SettingCategory } from '../../../core/models/settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsService } from '../../../core/services/settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformProductSourcesComponent } from './platform-product-sources.component';

const item = (key: string, value: string | null) => ({
  key,
  category: 'Integrations',
  isSecret: false,
  isList: false,
  description: null,
  value,
  hasValue: value !== null,
  valueHint: null,
});

describe('PlatformProductSourcesComponent', () => {
  let fixture: ComponentFixture<PlatformProductSourcesComponent>;
  let settings: jasmine.SpyObj<SettingsService>;
  let notify: jasmine.SpyObj<NotificationService>;

  function render(items: ReturnType<typeof item>[]): PlatformProductSourcesComponent {
    settings = jasmine.createSpyObj('SettingsService', ['getCategory', 'update']);
    settings.getCategory.and.returnValue(of({ category: 'Integrations', items } as SettingCategory));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    TestBed.configureTestingModule({
      declarations: [PlatformProductSourcesComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: SettingsService, useValue: settings },
        { provide: NotificationService, useValue: notify },
      ],
    });
    fixture = TestBed.createComponent(PlatformProductSourcesComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('starts On when nothing has been saved', () => {
    const component = render([]);

    expect([component.documentUpload, component.websiteScanning]).toEqual([true, true]);
  });

  it('shows what is saved', () => {
    const component = render([item('Integrations:ProductSources:DocumentUpload', 'true'), item('Integrations:ProductSources:WebsiteScanning', 'false')]);

    expect([component.documentUpload, component.websiteScanning]).toEqual([true, false]);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="websites"]')?.textContent).toContain('Off');
  });

  it('saves each switch at once, under its own key', () => {
    const component = render([]);
    settings.update.and.returnValue(of(undefined));

    component.setWebsites(false);
    expect(settings.update).toHaveBeenCalledWith('Integrations', { 'Integrations:ProductSources:WebsiteScanning': 'false' });
    expect(notify.success).toHaveBeenCalledWith('Website scanning is switched off. It applies from the next request.');

    component.setDocuments(false);
    expect(settings.update).toHaveBeenCalledWith('Integrations', { 'Integrations:ProductSources:DocumentUpload': 'false' });
    expect([component.documentUpload, component.websiteScanning]).toEqual([false, false]);
  });

  it('puts a switch back when the save is refused', () => {
    const component = render([]);
    settings.update.and.returnValue(throwError(() => new Error('403')));

    component.setDocuments(false);

    expect(component.documentUpload).toBeTrue();
  });
});
