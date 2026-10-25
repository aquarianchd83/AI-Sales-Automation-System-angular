import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { DemoSms, DemoSmsOutboxService } from '../../core/services/demo-sms-outbox.service';
import { SharedModule } from '../../shared/shared.module';
import { DemoSmsOutboxComponent } from './demo-sms-outbox.component';

const sms = (to: string, token: string): DemoSms => ({
  sentAtUtc: '2026-10-25T10:00:00Z',
  to,
  body: `Hi Asha! Would you like to learn about Acme? View the details and choose whether to receive WhatsApp follow-ups: http://localhost:4200/consent/${token}`,
  link: `http://localhost:4200/consent/${token}`,
  path: `/consent/${token}`,
});

describe('DemoSmsOutboxComponent', () => {
  let fixture: ComponentFixture<DemoSmsOutboxComponent>;
  let service: jasmine.SpyObj<DemoSmsOutboxService>;
  const root = () => fixture.nativeElement as HTMLElement;

  function create(result: ReturnType<DemoSmsOutboxService['list']>): void {
    service.list.and.returnValue(result);
    fixture = TestBed.createComponent(DemoSmsOutboxComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    service = jasmine.createSpyObj('DemoSmsOutboxService', ['list']);
    TestBed.configureTestingModule({
      declarations: [DemoSmsOutboxComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: DemoSmsOutboxService, useValue: service }],
    });
  });

  it('lists each SMS with a button that opens its consent page', () => {
    create(of([sms('+919800000001', 'tokA'), sms('+919800000002', 'tokB')]));

    const rows = root().querySelectorAll('[data-testid="sms"]');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('+919800000001');
    expect(rows[0].textContent).toContain('Would you like to learn about Acme?');
    const hrefs = Array.from(root().querySelectorAll<HTMLAnchorElement>('[data-testid="open-here"]')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['/consent/tokA', '/consent/tokB']);
  });

  it('says so when nothing has been sent yet', () => {
    create(of([]));

    expect(root().querySelector('[data-testid="empty"]')).not.toBeNull();
  });

  it('explains how to switch it on when the API says the outbox is off', () => {
    create(throwError(() => ({ status: 404 })));

    expect(root().querySelector('[data-testid="off"]')!.textContent).toContain('DemoOutboxEnabled');
  });
});
