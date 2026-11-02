import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { BookingConversationPanelComponent } from './booking-conversation-panel/booking-conversation-panel.component';
import { BookingListComponent } from './booking-list/booking-list.component';
import { BookingRescheduleDialogComponent } from './booking-reschedule-dialog/booking-reschedule-dialog.component';

const routes: Routes = [{ path: '', component: BookingListComponent }];

@NgModule({
  declarations: [BookingListComponent, BookingConversationPanelComponent, BookingRescheduleDialogComponent],
  imports: [SharedModule, RouterModule.forChild(routes)],
})
export class BookingsModule {}
