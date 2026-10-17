import { TestBed } from '@angular/core/testing';
import { SettingItem } from '../../../core/models/settings.model';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { SettingsService } from '../../../core/services/settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { SettingsListComponent } from './settings-list.component';

const category = (name: string) => ({ category: name, items: [{ key: `${name}:Key`, value: 'v', isSecret: false, isList: false, description: null }] });

describe('SettingsListComponent', () => {
  const panelsFor = (routeData: Record<string, unknown>) => {
    const names = ['WhatsApp', 'AiProviders', 'Campaigns', 'MediaStorage', 'App', 'Email', 'Sms', 'PlatformWhatsApp', 'Razorpay', 'Retention'];
    TestBed.configureTestingModule({
      declarations: [SettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: SettingsService, useValue: { getAll: () => of(names.map(category)) } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: routeData } } },
      ],
    });

    const fixture = TestBed.createComponent(SettingsListComponent);
    fixture.detectChanges();

    return fixture.componentInstance.panels.map((p) => p.category.category);
  };

  it('leaves out the categories that have a settings screen of their own', () => {
    expect(panelsFor({})).toEqual(['AiProviders', 'Campaigns', 'Retention']);
  });

  it('renders one card per provider on the AI Providers screen, with no General card', () => {
    const item = (key: string) => ({ key, value: 'v', isSecret: false, isList: false, description: null });
    TestBed.configureTestingModule({
      declarations: [SettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        {
          provide: SettingsService,
          useValue: {
            getAll: () => of([{ category: 'AiProviders', items: ['AiProviders:Provider', 'AiProviders:OpenAI:ApiKey', 'AiProviders:Google:ApiKey'].map(item) }]),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { categories: ['AiProviders'] } } } },
      ],
    });

    const fixture = TestBed.createComponent(SettingsListComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(Array.from(root.querySelectorAll('.group-title')).map((e) => e.textContent?.trim())).toEqual(['OpenAI', 'Google']);
    expect(root.querySelectorAll('input').length).toBe(2);
  });

  it('offers a toggle for an On/Off setting, a dropdown for other fixed choices and a text box for one without', () => {
    TestBed.configureTestingModule({
      declarations: [SettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        {
          provide: SettingsService,
          useValue: {
            getAll: () =>
              of([
                {
                  category: 'ContentStudio',
                  items: [
                    { key: 'ContentStudio:Enabled', value: 'false', isSecret: false, isList: false, description: null, options: ['true', 'false'] },
                    { key: 'ContentStudio:StorageMode', value: 'PublicBucket', isSecret: false, isList: false, description: null, options: ['PublicBucket', 'SignedUrls'] },
                    { key: 'ContentStudio:StorageKeyPrefix', value: 'studio', isSecret: false, isList: false, description: null },
                  ],
                },
              ]),
          },
        },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { categories: ['ContentStudio'] } } } },
      ],
    });

    const fixture = TestBed.createComponent(SettingsListComponent);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('mat-slide-toggle').length).toBe(1);
    expect(root.querySelectorAll('mat-select').length).toBe(1);
    expect(root.querySelectorAll('input[type="text"]').length).toBe(1);
    expect(fixture.componentInstance.panels[0].form.get('ContentStudio:Enabled')?.value).toBe('false');

    // Flipping the toggle stores the text "true" and lets the panel be saved.
    const component = fixture.componentInstance;
    const item = component.panels[0].category.items.find((i) => i.key === 'ContentStudio:Enabled')!;
    expect(component.isOn(item)).toBeFalse();
    component.setSwitch(item, true);
    expect(component.panels[0].form.get('ContentStudio:Enabled')?.value).toBe('true');
    expect(component.panels[0].form.pristine).toBeFalse();
    expect(fixture.componentInstance.panels[0].form.get('ContentStudio:StorageMode')?.value).toBe('PublicBucket');
  });

  it('treats a true/false setting as an On/Off switch and anything else as a choice', () => {
    const component = SettingsListComponent.prototype;

    expect(component.isSwitch({ options: ['true', 'false'] } as SettingItem)).toBeTrue();
    expect(component.isSwitch({ options: ['PublicBucket', 'Private'] } as SettingItem)).toBeFalse();
    expect(component.isSwitch({ options: null } as SettingItem)).toBeFalse();
  });

  it('shows only the AI providers on its own screen', () => {
    expect(panelsFor({ categories: ['AiProviders'] })).toEqual(['AiProviders']);
  });

  it('shows everything but the AI providers on the System screen', () => {
    expect(panelsFor({ exclude: ['AiProviders'] })).toEqual(['Campaigns', 'Retention']);
  });
});
