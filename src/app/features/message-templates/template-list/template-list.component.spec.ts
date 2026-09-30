import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { RouterTestingModule } from '@angular/router/testing';

import { TemplateListComponent } from './template-list.component';
import { MessageTemplate } from '../../../core/models/message-template.model';
import { SharedModule } from '../../../shared/shared.module';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';

function template(name: string, metaTemplateId: string | null, status = 'Pending'): MessageTemplate {
  return {
    id: `id-${name}`,
    name,
    language: 'en',
    category: 'Marketing',
    whatsAppTemplateName: name,
    whatsAppTemplateStatus: status,
    bodyText: 'Hi',
    isActive: true,
    createdAt: '2026-09-01T00:00:00Z',
    metaTemplateId,
  };
}

describe('TemplateListComponent review vs Meta sync', () => {
  let fixture: ComponentFixture<TemplateListComponent>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TemplateListComponent],
      imports: [SharedModule, HttpClientTestingModule, NoopAnimationsModule, RouterTestingModule],
      providers: [{ provide: AuthService, useValue: { hasAnyRole: () => true, currentUser$: of(null) } }],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TemplateListComponent);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === `${environment.apiBaseUrl}/message-templates`)
      .flush({
        items: [template('on_meta', '1387908590149880'), template('local_only', null)],
        page: 1,
        pageSize: 25,
        totalCount: 2,
        totalPages: 1,
      });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('syncs a template that is on Meta instead of letting it be approved by hand', () => {
    const rows = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('tr.mat-mdc-row'));
    const visible = (row: HTMLElement, label: string) =>
      Array.from<HTMLElement>(row.querySelectorAll('button.review-button')).some(
        (b) => !b.hidden && b.textContent?.includes(label)
      );

    expect(visible(rows[0], 'Sync')).toBeTrue();
    expect(visible(rows[0], 'Review')).toBeFalse();
    expect(visible(rows[1], 'Review')).toBeTrue();
    expect(visible(rows[1], 'Sync')).toBeFalse();
  });

  it('reports what Meta says after a sync, and refreshes the list', () => {
    const notify = spyOn(TestBed.inject(NotificationService), 'info');
    fixture.componentInstance.sync(template('on_meta', '1387908590149880'));

    const req = http.expectOne(`${environment.apiBaseUrl}/message-templates/id-on_meta/sync`);
    expect(req.request.method).toBe('POST');
    req.flush({ template: template('on_meta', '1387908590149880', 'Pending'), pushError: null });

    expect(notify).toHaveBeenCalledWith(jasmine.stringContaining('Meta says'));
    http.expectOne((r) => r.url === `${environment.apiBaseUrl}/message-templates`).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
  });
});

