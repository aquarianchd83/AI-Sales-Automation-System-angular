import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
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
    headerMediaAssetId: null,
    headerOnMeta: false,
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

  it('offers Sync on every template, and Review only on one that is not on Meta yet', () => {
    const rows = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('tr.mat-mdc-row'));
    const visible = (row: HTMLElement, label: string) =>
      Array.from<HTMLElement>(row.querySelectorAll('button.review-button')).some(
        (b) => !b.hidden && b.textContent?.includes(label)
      );

    expect(visible(rows[0], 'Sync')).toBeTrue();
    expect(visible(rows[0], 'Review')).toBeFalse();
    // Not on Meta yet: Sync is how it gets submitted, so it must be there too.
    expect(visible(rows[1], 'Sync')).toBeTrue();
    expect(visible(rows[1], 'Review')).toBeTrue();
  });

  it('says a template was submitted to Meta after its first sync', () => {
    const notify = spyOn(TestBed.inject(NotificationService), 'success');
    fixture.componentInstance.sync(template('local_only', null));

    const req = http.expectOne(`${environment.apiBaseUrl}/message-templates/id-local_only/sync`);
    req.flush({ template: template('local_only', '1234567890', 'Pending'), pushError: null });

    expect(notify).toHaveBeenCalledWith(jasmine.stringContaining('was submitted to Meta'));
    http.expectOne((r) => r.url === `${environment.apiBaseUrl}/message-templates`).flush({ items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 });
  });

  it('shows the template rules and remembers whether the panel was closed', () => {
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Template rules');
    expect(text).toContain('lower-case letters, digits and underscores');
    expect(text).toContain('Only Meta approves a template');

    localStorage.removeItem('templates.rulesOpen');
    fixture.componentInstance.setRulesOpen(false);
    expect(localStorage.getItem('templates.rulesOpen')).toBe('false');
    fixture.componentInstance.setRulesOpen(true);
    expect(localStorage.getItem('templates.rulesOpen')).toBe('true');
    localStorage.removeItem('templates.rulesOpen');
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

  describe('duplicate', () => {
    const emptyList = { items: [], page: 1, pageSize: 25, totalCount: 0, totalPages: 0 };

    it('is in the row menu and opens the create form pre-filled from that template', () => {
      const dialog = spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(false) } as never);
      const source = template('on_meta', '1387908590149880', 'Approved');

      fixture.componentInstance.duplicate(source);

      expect(dialog).toHaveBeenCalledWith(jasmine.any(Function), jasmine.objectContaining({ data: { mode: 'duplicate', template: source } }));
    });

    it('lists "Duplicate as new template" in each row\'s More menu', () => {
      const more = fixture.nativeElement.querySelector('tr.mat-mdc-row button[matTooltip="More"]') as HTMLButtonElement;
      more.click();
      fixture.detectChanges();

      expect(document.body.textContent).toContain('Duplicate as new template');
    });

    it('opens the copy when the edit dialog asks for one, without reloading the list', () => {
      const dialog = spyOn(TestBed.inject(MatDialog), 'open').and.returnValues(
        { afterClosed: () => of('duplicate') } as never,
        { afterClosed: () => of(false) } as never
      );
      const source = template('on_meta', '1387908590149880', 'Approved');

      fixture.componentInstance.edit(source);

      expect(dialog.calls.count()).toBe(2);
      expect(dialog.calls.argsFor(1)[1]).toEqual(jasmine.objectContaining({ data: { mode: 'duplicate', template: source } }));
    });

    it('reloads the list once a copy has been saved', () => {
      spyOn(TestBed.inject(MatDialog), 'open').and.returnValue({ afterClosed: () => of(true) } as never);

      fixture.componentInstance.duplicate(template('on_meta', '1387908590149880'));

      http.expectOne((r) => r.url === `${environment.apiBaseUrl}/message-templates`).flush(emptyList);
    });
  });
});
