import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';

import {
  QuestionnaireTemplateDetail,
  QuestionnaireTemplateSummary,
  QuestionnaireVersionStatus,
} from '../../../core/models/content-studio.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformStudioQuestionnaireService } from '../../../core/services/platform-studio-questionnaire.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformStudioQuestionnairesComponent } from './platform-studio-questionnaires.component';

const JSON_V1 = '{"questions":[{"key":"a","type":"ShortText","prompt":"A?"}]}';

const summary = (over: Partial<QuestionnaireTemplateSummary> = {}): QuestionnaireTemplateSummary => ({
  id: 't1',
  key: 'generic',
  title: 'Generic',
  description: null,
  industry: null,
  isActive: true,
  latestVersion: 1,
  publishedVersion: null,
  updatedAt: null,
  ...over,
});

const detail = (versions: { number: number; status: QuestionnaireVersionStatus; json?: string }[], over: Partial<QuestionnaireTemplateSummary> = {}): QuestionnaireTemplateDetail => ({
  template: summary(over),
  versions: versions.map((v) => ({ id: `v${v.number}`, number: v.number, status: v.status, definitionJson: v.json ?? JSON_V1, questionCount: 1, publishedAtUtc: null })),
});

describe('PlatformStudioQuestionnairesComponent', () => {
  let fixture: ComponentFixture<PlatformStudioQuestionnairesComponent>;
  let service: jasmine.SpyObj<PlatformStudioQuestionnaireService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let dialogAnswer: boolean;

  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(templates: QuestionnaireTemplateSummary[]): HTMLElement {
    service = jasmine.createSpyObj('PlatformStudioQuestionnaireService', ['list', 'get', 'getStarter', 'validate', 'create', 'update', 'createVersion', 'saveVersion', 'publishVersion']);
    service.list.and.returnValue(of(templates));
    service.getStarter.and.returnValue(of({ definitionJson: '{"questions":[]}' }));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    dialogAnswer = true;

    TestBed.configureTestingModule({
      declarations: [PlatformStudioQuestionnairesComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformStudioQuestionnaireService, useValue: service },
        { provide: NotificationService, useValue: notify },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogAnswer) }) } },
      ],
    });
    fixture = TestBed.createComponent(PlatformStudioQuestionnairesComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('lists the templates with what is live and what is only a draft', () => {
    const el = render([
      summary({ id: 'a', title: 'Generic', publishedVersion: 2, latestVersion: 2 }),
      summary({ id: 'b', title: 'Eye care', key: 'eye-care', industry: 'Eye care', publishedVersion: 1, latestVersion: 2 }),
      summary({ id: 'c', title: 'Draft only', key: 'draft', latestVersion: 1, isActive: false }),
    ]);

    const rows = Array.from(el.querySelectorAll('.template-row')).map((r) => text(r));
    expect(rows[0]).toContain('Live v2');
    expect(rows[0]).not.toContain('Draft v');
    expect(rows[1]).toContain('Live v1');
    expect(rows[1]).toContain('Draft v2');
    expect(rows[1]).toContain('Eye care');
    expect(rows[2]).toContain('Draft v1');
    expect(rows[2]).toContain('Off');
  });

  it('opens a template on its draft version, editable', () => {
    const el = render([summary()]);
    service.get.and.returnValue(of(detail([{ number: 2, status: QuestionnaireVersionStatus.Draft, json: '{"questions":[]}' }, { number: 1, status: QuestionnaireVersionStatus.Published }])));

    (el.querySelector('.template-row') as HTMLElement).click();
    fixture.detectChanges();

    expect(fixture.componentInstance.version?.number).toBe(2);
    expect(fixture.componentInstance.isDraft).toBeTrue();
    expect((el.querySelector('textarea.json') as HTMLTextAreaElement).readOnly).toBeFalse();
    expect(text(el.querySelector('.versions'))).toContain('v1 published');
    expect(text(el.querySelector('.versions'))).toContain('v2 draft');
  });

  it('shows a published version read-only and offers a new version', () => {
    const el = render([summary()]);
    service.get.and.returnValue(of(detail([{ number: 1, status: QuestionnaireVersionStatus.Published }], { publishedVersion: 1 })));

    fixture.componentInstance.select(summary());
    fixture.detectChanges();

    expect(fixture.componentInstance.isDraft).toBeFalse();
    expect((el.querySelector('textarea.json') as HTMLTextAreaElement).readOnly).toBeTrue();
    expect(text(el.querySelector('.definition-bar'))).toContain('read only');
    expect(text(el.querySelector('.versions'))).toContain('New version');
    expect(el.querySelector('.definition-actions')?.textContent).not.toContain('Publish');
  });

  it('offers no second draft while one exists', () => {
    const el = render([summary()]);
    service.get.and.returnValue(of(detail([{ number: 2, status: QuestionnaireVersionStatus.Draft }, { number: 1, status: QuestionnaireVersionStatus.Published }])));

    fixture.componentInstance.select(summary());
    fixture.detectChanges();

    expect(text(el.querySelector('.versions'))).not.toContain('New version');
  });

  it('starts a new template from the starter definition', () => {
    const el = render([]);

    fixture.componentInstance.startNew();
    fixture.detectChanges();

    expect(service.getStarter).toHaveBeenCalled();
    expect(fixture.componentInstance.json).toBe('{"questions":[]}');
    expect(text(el.querySelector('.detail-head'))).toContain('New template');
  });

  it('creates a template from the form, refusing a bad key without calling the server', () => {
    render([]);
    const component = fixture.componentInstance;
    component.startNew();
    service.create.and.returnValue(of(detail([{ number: 1, status: QuestionnaireVersionStatus.Draft }], { key: 'eye-care', title: 'Eye care' })));

    component.meta.patchValue({ key: 'Bad Key', title: 'Eye care' });
    component.create();
    expect(service.create).not.toHaveBeenCalled();

    component.meta.patchValue({ key: 'eye-care', industry: ' Eye care ' });
    component.create();

    expect(service.create).toHaveBeenCalledWith(jasmine.objectContaining({ key: 'eye-care', title: 'Eye care', industry: 'Eye care', definitionJson: '{"questions":[]}' }));
    expect(component.panel).toBe('edit');
    expect(notify.success).toHaveBeenCalled();
  });

  it('saves a draft only when its text changed', () => {
    render([summary()]);
    const component = fixture.componentInstance;
    service.get.and.returnValue(of(detail([{ number: 1, status: QuestionnaireVersionStatus.Draft }])));
    service.saveVersion.and.returnValue(of(detail([{ number: 1, status: QuestionnaireVersionStatus.Draft, json: '{"questions":[]}' }])));
    component.select(summary());

    component.saveDraft();
    expect(service.saveVersion).not.toHaveBeenCalled();

    component.json = '{"questions":[]}';
    component.saveDraft();
    expect(service.saveVersion).toHaveBeenCalledWith('t1', 1, '{"questions":[]}');
  });

  it('asks for confirmation before publishing, and does nothing if declined', () => {
    render([summary()]);
    const component = fixture.componentInstance;
    service.get.and.returnValue(of(detail([{ number: 1, status: QuestionnaireVersionStatus.Draft }])));
    service.publishVersion.and.returnValue(of(detail([{ number: 1, status: QuestionnaireVersionStatus.Published }], { publishedVersion: 1 })));
    component.select(summary());

    dialogAnswer = false;
    component.publish();
    expect(service.publishVersion).not.toHaveBeenCalled();

    dialogAnswer = true;
    component.publish();
    expect(service.publishVersion).toHaveBeenCalledWith('t1', 1);
    expect(component.isDraft).toBeFalse();
  });

  it('will not publish text that has not been saved', () => {
    render([summary()]);
    const component = fixture.componentInstance;
    service.get.and.returnValue(of(detail([{ number: 1, status: QuestionnaireVersionStatus.Draft }])));
    component.select(summary());

    component.json = '{"questions":[]}';
    component.publish();

    expect(service.publishVersion).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledWith('Save the draft before publishing it.');
  });

  it('reports every problem the checker finds', () => {
    const el = render([summary()]);
    const component = fixture.componentInstance;
    component.startNew();
    service.validate.and.returnValue(of({ valid: false, questionCount: 0, issues: [{ key: 'a', message: 'needs a prompt' }, { key: 'b', message: 'key used twice' }] }));

    component.validate();
    fixture.detectChanges();

    expect(text(el.querySelector('.validation'))).toContain('2 problem(s)');
    expect(text(el.querySelector('.validation'))).toContain('needs a prompt');
    expect(text(el.querySelector('.validation'))).toContain('key used twice');
  });

  it('previews exactly what a tenant would see, and says so when the text is not valid JSON', () => {
    const el = render([summary()]);
    const component = fixture.componentInstance;
    component.startNew();
    component.json = JSON_V1;
    component.view = 'preview';
    fixture.detectChanges();

    expect(el.querySelector('app-questionnaire-form [data-question="a"]')).not.toBeNull();

    component.json = '{ not json';
    fixture.detectChanges();
    expect(el.querySelector('app-questionnaire-form')).toBeNull();
    expect(text(el.querySelector('.preview'))).toContain('not valid JSON');
  });
});
