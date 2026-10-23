import { LayoutModule as CdkLayoutModule } from '@angular/cdk/layout';
import { NgModule } from '@angular/core';

import { SharedModule } from '../shared/shared.module';
import { KnowledgeHubComponent } from './knowledge-hub/knowledge-hub.component';
import { ShellComponent } from './shell/shell.component';

@NgModule({
  declarations: [ShellComponent, KnowledgeHubComponent],
  imports: [SharedModule, CdkLayoutModule],
  exports: [ShellComponent, KnowledgeHubComponent],
})
export class LayoutModule {}
