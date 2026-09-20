import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { HandoffListComponent } from './handoff-list/handoff-list.component';
import { HandoffSummaryCardComponent } from './handoff-summary-card/handoff-summary-card.component';
import { HandoffSummaryDialogComponent } from './handoff-summary-dialog/handoff-summary-dialog.component';
import { ResolveHandoffDialogComponent } from './resolve-handoff-dialog/resolve-handoff-dialog.component';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: HandoffListComponent }];

@NgModule({
  declarations: [
    HandoffListComponent,
    HandoffSummaryCardComponent,
    HandoffSummaryDialogComponent,
    ResolveHandoffDialogComponent,
  ],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class HandoffsModule {}
