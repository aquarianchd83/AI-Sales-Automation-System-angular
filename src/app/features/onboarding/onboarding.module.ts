import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { OnboardingPageComponent, onboardingPanelGuard } from './onboarding-page/onboarding-page.component';
import { OnboardingStepHostComponent } from './step-panel/onboarding-step-host.component';

// canDeactivate keeps the tenant on this page: links from the step on screen open in its panel instead.
const routes: Routes = [{ path: '', component: OnboardingPageComponent, canDeactivate: [onboardingPanelGuard] }];

@NgModule({
  declarations: [OnboardingPageComponent, OnboardingStepHostComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class OnboardingModule {}
