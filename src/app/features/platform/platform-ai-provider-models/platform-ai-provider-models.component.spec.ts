import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { AiProviderModelService } from '../../../core/services/ai-provider-model.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformAiProviderModelsComponent } from './platform-ai-provider-models.component';

describe('PlatformAiProviderModelsComponent', () => {
  function render() {
    TestBed.configureTestingModule({
      declarations: [PlatformAiProviderModelsComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: AiProviderModelService, useValue: { getAll: () => of([]) } },
        { provide: NotificationService, useValue: { success: () => undefined } },
      ],
    });
    const fixture = TestBed.createComponent(PlatformAiProviderModelsComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, root: fixture.nativeElement as HTMLElement };
  }

  it('has a Back button that returns to the previous page', () => {
    const { component, root } = render();
    spyOn(component, 'hasHistory').and.returnValue(true);
    const back = spyOn(TestBed.inject(Location), 'back');

    (root.querySelector('[data-testid="back-button"]') as HTMLButtonElement).click();

    expect(back).toHaveBeenCalled();
  });

  it('opened directly, Back goes to AI Providers instead', () => {
    const { component } = render();
    spyOn(component, 'hasHistory').and.returnValue(false);
    const navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);

    component.goBack();

    expect(navigate).toHaveBeenCalledWith('/settings/ai-providers');
  });
});
