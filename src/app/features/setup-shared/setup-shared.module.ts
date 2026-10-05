import { NgModule } from '@angular/core';

import { SharedModule } from '../../shared/shared.module';
import { SetupFieldComponent } from './setup-field/setup-field.component';
import { SetupStatusChipComponent } from './setup-status-chip.component';
import { SetupWizardComponent } from './setup-wizard/setup-wizard.component';

const COMPONENTS = [SetupFieldComponent, SetupWizardComponent, SetupStatusChipComponent];

/** The plan-driven setup building blocks - used by the Talent's Applications screens and the admin's preview. */
@NgModule({
  declarations: COMPONENTS,
  imports: [SharedModule],
  exports: COMPONENTS,
})
export class SetupSharedModule {}
