import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { SettingsService } from '../../../core/services/settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { SettingsListComponent } from './settings-list.component';

const category = (name: string) => ({ category: name, items: [{ key: `${name}:Key`, value: 'v', isSecret: false, isList: false, description: null }] });

describe('SettingsListComponent', () => {
  it('leaves out the categories that have a settings screen of their own', () => {
    const names = ['WhatsApp', 'AiProviders', 'Campaigns', 'MediaStorage', 'App', 'Email', 'Sms', 'PlatformWhatsApp', 'Razorpay', 'Retention'];
    TestBed.configureTestingModule({
      declarations: [SettingsListComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [{ provide: SettingsService, useValue: { getAll: () => of(names.map(category)) } }],
    });

    const fixture = TestBed.createComponent(SettingsListComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.panels.map((p) => p.category.category)).toEqual(['WhatsApp', 'AiProviders', 'Campaigns', 'Retention']);
  });
});
