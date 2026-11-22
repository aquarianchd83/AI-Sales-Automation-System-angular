import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { PlatformFeatureSwitch } from '../../../core/models/wallet.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformFeatureSwitchService } from '../../../core/services/platform-feature-switch.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformFeaturesComponent } from './platform-features.component';

const item = (over: Partial<PlatformFeatureSwitch> = {}): PlatformFeatureSwitch => ({
  feature: 'ContentStudio',
  label: 'Content Studio',
  description: 'AI content generation and video rendering.',
  published: true,
  updatedAtUtc: null,
  ...over,
});

describe('PlatformFeaturesComponent', () => {
  let service: jasmine.SpyObj<PlatformFeatureSwitchService>;
  let notify: jasmine.SpyObj<NotificationService>;

  const create = (features: PlatformFeatureSwitch[]) => {
    service = jasmine.createSpyObj('PlatformFeatureSwitchService', ['getAll', 'setPublished']);
    service.getAll.and.returnValue(of(features));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    TestBed.configureTestingModule({
      declarations: [PlatformFeaturesComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformFeatureSwitchService, useValue: service },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const fixture = TestBed.createComponent(PlatformFeaturesComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('lists every feature and counts the unpublished ones', () => {
    const fixture = create([item(), item({ feature: 'LeadDiscovery', label: 'Lead discovery', published: false })]);
    expect(fixture.componentInstance.features.length).toBe(2);
    expect(fixture.componentInstance.unpublishedCount).toBe(1);
  });

  it('unpublishes a feature and replaces it with the saved answer', () => {
    const fixture = create([item()]);
    service.setPublished.and.returnValue(of(item({ published: false, updatedAtUtc: '2026-11-22T10:00:00Z' })));

    fixture.componentInstance.toggle(fixture.componentInstance.features[0], false);

    expect(service.setPublished).toHaveBeenCalledWith('ContentStudio', false);
    expect(fixture.componentInstance.features[0].published).toBeFalse();
    expect(notify.success).toHaveBeenCalled();
  });

  it('keeps the old state and says so when the save fails', () => {
    const fixture = create([item()]);
    service.setPublished.and.returnValue(throwError(() => new Error('boom')));

    fixture.componentInstance.toggle(fixture.componentInstance.features[0], false);

    expect(fixture.componentInstance.features[0].published).toBeTrue();
    expect(notify.error).toHaveBeenCalled();
  });
});
