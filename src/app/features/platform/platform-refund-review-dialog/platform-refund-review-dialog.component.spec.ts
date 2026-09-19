import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import { RefundRequest, RefundStatus } from '../../../core/models/billing.model';
import { PlatformRefundService } from '../../../core/services/platform-refund.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformRefundReviewDialogComponent, PlatformRefundReviewDialogData } from './platform-refund-review-dialog.component';

const REQUEST: RefundRequest = {
  id: 'req-1',
  tenantId: 'tenant-1',
  tenantName: 'Acme',
  paymentId: 'pay-1',
  paymentDescription: '1,000 AI conversations',
  status: RefundStatus.Requested,
  reason: 'Bought too many',
  eligibleAmountCents: 1400,
  eligibleLocalAmount: 1162,
  currencyCode: 'INR',
  currencySymbol: '₹',
  refundedAmountCents: null,
  refundedLocalAmount: null,
  reviewNote: null,
  failureReason: null,
  createdAt: '2026-09-16T00:00:00Z',
  reviewedAtUtc: null,
};

describe('PlatformRefundReviewDialogComponent', () => {
  function setup(data: PlatformRefundReviewDialogData) {
    const refunds = {
      approve: jasmine.createSpy('approve').and.returnValue(of({ ...REQUEST, status: RefundStatus.Refunded })),
      reject: jasmine.createSpy('reject').and.returnValue(of({ ...REQUEST, status: RefundStatus.Rejected })),
      refundDirect: jasmine.createSpy('refundDirect').and.returnValue(of({ ...REQUEST, status: RefundStatus.Refunded })),
    };
    const dialogRef = { close: jasmine.createSpy('close') };

    TestBed.configureTestingModule({
      declarations: [PlatformRefundReviewDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformRefundService, useValue: refunds },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });

    const fixture = TestBed.createComponent(PlatformRefundReviewDialogComponent);
    fixture.detectChanges();
    return { component: fixture.componentInstance, refunds, dialogRef };
  }

  it('approves the full eligible amount by default, in the cents the API takes', () => {
    const { component, refunds, dialogRef } = setup({ mode: 'approve', request: REQUEST });

    component.submit();

    expect(refunds.approve).toHaveBeenCalledWith('req-1', '', 1400);
    expect(dialogRef.close).toHaveBeenCalled();
  });

  it('converts a partial amount typed in the tenant currency back to base-USD cents', () => {
    const { component, refunds } = setup({ mode: 'approve', request: REQUEST });

    component.form.controls.amount.setValue(581); // half of ₹1,162

    component.submit();

    expect(refunds.approve).toHaveBeenCalledWith('req-1', '', 700);
  });

  it('never approves for more than the rules allow', () => {
    const { component, refunds } = setup({ mode: 'approve', request: REQUEST });

    component.form.controls.amount.setValue(5000);
    component.submit();

    expect(refunds.approve).not.toHaveBeenCalled();
  });

  it('will not decline without a reason the tenant can read', () => {
    const { component, refunds } = setup({ mode: 'reject', request: REQUEST });

    component.form.controls.note.setValue('   ');
    component.submit();
    expect(refunds.reject).not.toHaveBeenCalled();

    component.form.controls.note.setValue('Credits were used');
    component.submit();
    expect(refunds.reject).toHaveBeenCalledWith('req-1', 'Credits were used');
  });

  it('needs a reason for a direct refund too, for the audit trail', () => {
    const payment = { id: 'pay-9', planName: 'Starter' } as never;
    const { component, refunds } = setup({ mode: 'direct', payment, tenantId: 'tenant-1' });

    component.submit();
    expect(refunds.refundDirect).not.toHaveBeenCalled();

    component.form.controls.note.setValue('Charged twice on our side');
    component.submit();
    expect(refunds.refundDirect).toHaveBeenCalledWith('tenant-1', 'pay-9', 'Charged twice on our side');
  });
});
