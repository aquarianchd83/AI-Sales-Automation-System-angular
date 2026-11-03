import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { SettingCategory, SettingItem } from '../../../core/models/settings.model';
import { NotificationService } from '../../../core/services/notification.service';
import { SettingsService } from '../../../core/services/settings.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformStorySettingsComponent } from './platform-story-settings.component';

const P = 'ContentStudio:Cinematic:';

const item = (name: string, over: Partial<SettingItem> = {}): SettingItem => ({
  key: P + name,
  category: 'ContentStudio',
  isSecret: false,
  isList: false,
  description: null,
  value: '',
  hasValue: false,
  valueHint: null,
  ...over,
});

const category = (): SettingCategory => ({
  category: 'ContentStudio',
  items: [
    // A tenant-facing studio switch that belongs to another screen.
    { ...item('x'), key: 'ContentStudio:Enabled', value: 'true' },
    item('GeminiApiKey', { isSecret: true }),
    item('OpenAiApiKey', { isSecret: true, hasValue: true, valueHint: 'ends ...abcd' }),
    item('SpeechProvider', { value: 'Simulator', options: ['Simulator', 'OpenAI'] }),
    item('VeoUsdPerSecond', { value: '0.12' }),
    item('SubtitleFontName', { value: '' }),
    item('BrandNewSetting', { value: '1' }),
  ],
});

describe('PlatformStorySettingsComponent', () => {
  let fixture: ComponentFixture<PlatformStorySettingsComponent>;
  let api: jasmine.SpyObj<SettingsService>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  beforeEach(() => {
    api = jasmine.createSpyObj('SettingsService', ['getCategory', 'update']);
    api.getCategory.and.returnValue(of(category()));
    api.update.and.returnValue(of(void 0));
    TestBed.configureTestingModule({
      declarations: [PlatformStorySettingsComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: SettingsService, useValue: api },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
      ],
    });
    fixture = TestBed.createComponent(PlatformStorySettingsComponent);
    fixture.detectChanges();
  });

  it('shows only the story studio settings, grouped, with the Veo key first', () => {
    expect(root().querySelector('[data-group="Video clips (Veo)"]')).not.toBeNull();
    expect(root().querySelector('[data-key="ContentStudio:Cinematic:GeminiApiKey"]')).not.toBeNull();
    expect(root().querySelector('[data-key="ContentStudio:Enabled"]')).toBeNull();
    expect(text(root().querySelector('[data-group="Other"]'))).toContain('Brand New Setting');
  });

  it('never shows a stored secret, only whether one is set', () => {
    const key = root().querySelector('[data-key="ContentStudio:Cinematic:OpenAiApiKey"]') as HTMLInputElement;

    expect(key.type).toBe('password');
    expect(key.value).toBe('');
    expect(key.placeholder).toContain('ends ...abcd');
  });

  it('sends only what changed, and never a blank secret', () => {
    const c = fixture.componentInstance;
    c.form.get('ContentStudio:Cinematic:GeminiApiKey')!.setValue('  AIza-new  ');
    c.form.get('ContentStudio:Cinematic:GeminiApiKey')!.markAsDirty();
    c.form.get('ContentStudio:Cinematic:OpenAiApiKey')!.setValue('');
    c.form.get('ContentStudio:Cinematic:OpenAiApiKey')!.markAsDirty();
    c.form.get('ContentStudio:Cinematic:SpeechProvider')!.setValue('OpenAI');
    c.form.get('ContentStudio:Cinematic:SpeechProvider')!.markAsDirty();
    fixture.detectChanges();

    (root().querySelector('[data-testid="save"]') as HTMLButtonElement).click();

    expect(api.update).toHaveBeenCalledWith('ContentStudio', {
      'ContentStudio:Cinematic:GeminiApiKey': 'AIza-new',
      'ContentStudio:Cinematic:SpeechProvider': 'OpenAI',
    });
  });

  it('does not save when nothing changed', () => {
    expect((root().querySelector('[data-testid="save"]') as HTMLButtonElement).disabled).toBeTrue();
    fixture.componentInstance.save();
    expect(api.update).not.toHaveBeenCalled();
  });
});
