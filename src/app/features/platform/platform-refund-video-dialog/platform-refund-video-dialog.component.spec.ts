import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';

import { PlatformStoryVideoRequestService } from '../../../core/services/platform-story-video-request.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformRefundVideoDialogComponent, PlatformRefundVideoDialogData } from './platform-refund-video-dialog.component';

describe('PlatformRefundVideoDialogComponent', () => {
  let fixture: ComponentFixture<PlatformRefundVideoDialogComponent>;
  let api: jasmine.SpyObj<PlatformStoryVideoRequestService>;
  let ref: jasmine.SpyObj<MatDialogRef<PlatformRefundVideoDialogComponent>>;

  const q = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector(selector) as HTMLElement | null;
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const type = (value: string) => {
    const box = q('[data-testid="refund-reason"]') as HTMLTextAreaElement;
    box.value = value;
    box.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const confirm = () => {
    (q('[data-testid="refund-confirm"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  };

  function render(prepaid: number | null = 1500): void {
    api = jasmine.createSpyObj('PlatformStoryVideoRequestService', ['reject']);
    ref = jasmine.createSpyObj('MatDialogRef', ['close']);
    const data: PlatformRefundVideoDialogData = { requestId: 'r1', title: 'Question hook', tenantName: 'Bansal Corp', prepaidCredits: prepaid };
    TestBed.configureTestingModule({
      declarations: [PlatformRefundVideoDialogComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformStoryVideoRequestService, useValue: api },
        { provide: MatDialogRef, useValue: ref },
        { provide: MAT_DIALOG_DATA, useValue: data },
      ],
    });
    fixture = TestBed.createComponent(PlatformRefundVideoDialogComponent);
    fixture.detectChanges();
  }

  it('says whose video it is, how many credits go back, and that the tenant reads the reason', () => {
    render();

    expect(text(q('[data-testid="refund-subject"]'))).toBe('Bansal Corp · Question hook');
    expect(text(q('[data-testid="refund-note"]'))).toContain('1,500 prepaid credits go back to the tenant');
    expect(text(q('[data-testid="refund-note"]'))).toContain('The tenant sees your reason');
    expect(text(q('[data-testid="refund-confirm"]'))).toBe('Refund 1,500 credits');
  });

  it('copes with a request whose prepaid credits are not known', () => {
    render(null);

    expect(text(q('[data-testid="refund-confirm"]'))).toBe('Refund the credits');
    expect(text(q('[data-testid="refund-note"]'))).toContain('The prepaid credits go back');
  });

  it('refuses a refund without a reason, and refunds nothing', () => {
    render();
    type('   ');

    confirm();

    expect(api.reject).not.toHaveBeenCalled();
    expect(ref.close).not.toHaveBeenCalled();
    expect(text(q('mat-error'))).toContain('Say why the video could not be made');
  });

  it('refunds with the reason, trimmed, and closes with the updated request', () => {
    render();
    const updated = { id: 'r1', status: 'Rejected' } as any;
    api.reject.and.returnValue(of(updated));
    type('  The video engine could not make this one.  ');

    confirm();

    expect(api.reject).toHaveBeenCalledOnceWith('r1', 'The video engine could not make this one.');
    expect(ref.close).toHaveBeenCalledOnceWith(updated);
  });

  it('stays open, with the reason still there, when the refund fails', () => {
    render();
    api.reject.and.returnValue(throwError(() => new Error('down')));
    type('Could not be made.');

    confirm();

    expect(ref.close).not.toHaveBeenCalled();
    expect((q('[data-testid="refund-reason"]') as HTMLTextAreaElement).value).toBe('Could not be made.');
    expect((q('[data-testid="refund-confirm"]') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('limits the reason to 500 characters', () => {
    render();

    expect(q('[data-testid="refund-reason"]')?.getAttribute('maxlength')).toBe('500');
  });
});
