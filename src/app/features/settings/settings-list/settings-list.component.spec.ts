import { TestBed } from '@angular/core/testing';
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

  it('renders one card per provider on the AI Providers screen', () => {
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
    expect(Array.from(root.querySelectorAll('.group-title')).map((e) => e.textContent?.trim())).toEqual(['General', 'OpenAI', 'Google']);
    expect(root.querySelectorAll('input').length).toBe(3);
  });

  it('shows only the AI providers on its own screen', () => {
    expect(panelsFor({ categories: ['AiProviders'] })).toEqual(['AiProviders']);
  });

  it('shows everything but the AI providers on the System screen', () => {
    expect(panelsFor({ exclude: ['AiProviders'] })).toEqual(['Campaigns', 'Retention']);
  });
});
