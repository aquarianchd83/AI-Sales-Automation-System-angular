import { LayoutModule as CdkLayoutModule } from '@angular/cdk/layout';
import { NgModule } from '@angular/core';

import { SharedModule } from '../shared/shared.module';
import { ShellComponent } from './shell/shell.component';

@NgModule({
  declarations: [ShellComponent],
  imports: [SharedModule, CdkLayoutModule],
  exports: [ShellComponent],
})
export class LayoutModule {}
