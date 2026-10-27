import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import {
  ContentScene,
  ContentTopic,
  ProjectDetail,
  ProjectSummary,
  ScriptVersion,
} from '../../../core/models/content-planner.model';
import { ContentPlannerService } from '../../../core/services/content-planner.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { StudioPlannerComponent } from './studio-planner.component';

const summary = (over: Partial<ProjectSummary> = {}): ProjectSummary => ({
  id: 'p1', title: 'Cataract awareness', goal: 'Get more bookings', language: 'English', status: 'Draft', topicCount: 0, versionCount: 0, chosenTopic: null, createdAt: '2026-10-27T10:00:00Z', updatedAt: null, ...over,
});

const topic = (over: Partial<ContentTopic> = {}): ContentTopic => ({
  id: 't1', title: 'Why cataract surgery is quick', rationale: 'It suits the goal.', status: 'Suggested', factCount: 2, isSimulated: false, provider: 'OpenAI', createdAt: '2026-10-27T10:00:00Z', ...over,
});

const scene = (over: Partial<ContentScene> = {}): ContentScene => ({
  id: 's1', order: 1, narration: 'We are open Monday to Saturday.', onScreenText: 'Open', durationSeconds: 8, visualHint: 'Clinic', claimStatus: 'Supported', claimNote: 'Backed by 1 verified fact.', editedByTenant: false,
  facts: [{ id: 'f1', category: 'Services', statement: 'The clinic is open Monday to Saturday.' }], ...over,
});

const version = (over: Partial<ScriptVersion> = {}): ScriptVersion => ({
  id: 'v1', projectId: 'p1', number: 1, topicId: 't1', topicTitle: 'Why cataract surgery is quick', status: 'Draft', targetSeconds: 45, totalSeconds: 16, notes: null, provider: 'OpenAI', model: 'gpt',
  promptVersion: 'planner-v1', isSimulated: false, activityId: null, createdAt: '2026-10-27T10:05:00Z', supported: 2, flagged: 0,
  scenes: [scene(), scene({ id: 's2', order: 2, narration: 'Book your visit today.', claimStatus: 'NoClaim', claimNote: null, facts: [] })], ...over,
});

const detail = (over: Partial<ProjectDetail> = {}): ProjectDetail => ({
  id: 'p1', title: 'Cataract awareness', goal: 'Get more bookings', language: 'English', status: 'Draft', usableFacts: 3, createdAt: '2026-10-27T10:00:00Z', updatedAt: null,
  topics: [], versions: [], currentVersion: null, ...over,
});

describe('StudioPlannerComponent', () => {
  let fixture: ComponentFixture<StudioPlannerComponent>;
  let api: jasmine.SpyObj<ContentPlannerService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let dialogResult = true;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (sel: string) => (root().querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const click = (testId: string) => {
    root().querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
    fixture.detectChanges();
  };
  const present = (testId: string) => root().querySelector(`[data-testid="${testId}"]`) !== null;

  function render(projects: ProjectSummary[], first: ProjectDetail | null): StudioPlannerComponent {
    api = jasmine.createSpyObj('ContentPlannerService', ['list', 'create', 'get', 'update', 'remove', 'generateTopics', 'updateTopic', 'generateScript', 'getVersion', 'recheck', 'updateScene', 'deleteScene']);
    api.list.and.returnValue(of(projects));
    if (first) {
      api.get.and.returnValue(of(first));
    }
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    TestBed.configureTestingModule({
      declarations: [StudioPlannerComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ContentPlannerService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(StudioPlannerComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => (dialogResult = true));
  afterEach(() => fixture?.destroy());

  it('says there are no projects yet and offers a new one', () => {
    render([], null);

    expect(present('no-projects')).toBeTrue();
    click('new');
    expect(present('create')).toBeTrue();
    expect(root().querySelector<HTMLButtonElement>('[data-testid="create-submit"]')!.disabled).toBeTrue(); // title and goal are required
  });

  it('creates a project from a title and a goal and opens it', () => {
    const c = render([], null);
    api.create.and.returnValue(of(detail()));
    click('new');
    c.newProject.patchValue({ title: '  Cataract awareness ', goal: ' Get more bookings ', language: 'Hindi' });
    fixture.detectChanges();

    click('create-submit');

    expect(api.create).toHaveBeenCalledWith({ title: 'Cataract awareness', goal: 'Get more bookings', language: 'Hindi' });
    expect(c.selectedId).toBe('p1');
    expect(present('create')).toBeFalse();
    expect(text('[data-detail="p1"] h2')).toBe('Cataract awareness');
  });

  it('opens the first project and says how many verified facts the writer has', () => {
    render([summary()], detail());

    expect(api.get).toHaveBeenCalledWith('p1');
    expect(text('[data-testid="fact-count"]')).toBe('Writing from 3 verified facts.');
    expect(present('no-facts')).toBeFalse();
    expect(present('no-topics')).toBeTrue();
  });

  it('will not suggest topics or write a script without verified facts, and points to Business facts', () => {
    const c = render([summary()], detail({ usableFacts: 0, topics: [topic({ status: 'Chosen' })] }));

    expect(text('[data-testid="no-facts"]')).toContain('no verified facts');
    expect(root().querySelector<HTMLButtonElement>('[data-testid="suggest"]')!.disabled).toBeTrue();
    expect(root().querySelector<HTMLButtonElement>('[data-testid="write"]')!.disabled).toBeTrue();
    c.suggestTopics();
    c.writeScript();
    expect(api.generateTopics).not.toHaveBeenCalled();
    expect(api.generateScript).not.toHaveBeenCalled();
  });

  it('suggests topics, then chooses one', () => {
    render([summary()], detail());
    api.generateTopics.and.returnValue(of(detail({ topics: [topic(), topic({ id: 't2', title: 'When we are open', isSimulated: true, factCount: 0 })] })));

    click('suggest');

    expect(api.generateTopics).toHaveBeenCalledWith('p1', null);
    expect(root().querySelectorAll('[data-topic]').length).toBe(2);
    expect(text('[data-topic="t2"]')).toContain('Test data');
    expect(text('[data-topic="t1"]')).toContain('Rests on 2 verified facts.');
    expect(present('choose-first')).toBeTrue();

    api.updateTopic.and.returnValue(of(detail({ topics: [topic({ status: 'Chosen' }), topic({ id: 't2', title: 'When we are open' })] })));
    root().querySelector<HTMLElement>('[data-topic="t1"] [data-testid="choose"]')!.click();
    fixture.detectChanges();

    expect(api.updateTopic).toHaveBeenCalledWith('t1', { status: 'Chosen' });
    expect(text('[data-topic="t1"]')).toContain('Chosen');
    expect(present('choose-first')).toBeFalse();
  });

  it('writes the script for the chosen topic with the length and notes, and shows each scene with whether a fact backs it', () => {
    const c = render([summary()], detail({ topics: [topic({ status: 'Chosen' })] }));
    api.generateScript.and.returnValue(of(detail({ status: 'Scripted', topics: [topic({ status: 'Chosen' })], versions: [{ id: 'v1', number: 1, topicTitle: 'T', status: 'Draft', isSimulated: false, sceneCount: 2, totalSeconds: 16, createdAt: '' }], currentVersion: version({ supported: 1, flagged: 1, scenes: [scene(), scene({ id: 's2', order: 2, narration: 'We treated 10,000 patients.', claimStatus: 'Unsupported', claimNote: '"We treated 10,000 patients." - Nothing you have told us supports it.', facts: [] })] }) })));
    c.length.setValue(60);
    c.notes.setValue('  friendly  ');

    click('write');

    expect(api.generateScript).toHaveBeenCalledWith('p1', { topicId: 't1', targetSeconds: 60, notes: 'friendly' });
    expect(notify.success).toHaveBeenCalledWith('Script version 1 written.');
    expect(text('[data-testid="version"]')).toContain('Draft - not approved');
    expect(root().querySelectorAll('[data-scene]').length).toBe(2);
    expect(text('[data-scene="s1"] [data-testid="claim"]')).toBe('Backed by a verified fact');
    expect(text('[data-scene="s2"] [data-testid="claim"]')).toBe('No fact behind it');
    expect(text('[data-scene="s2"] [data-testid="claim-note"]')).toContain('Nothing you have told us supports it');
    expect(text('[data-scene="s1"]')).toContain('The clinic is open Monday to Saturday.'); // the cited fact
    expect(text('[data-testid="flagged"]')).toContain('1 scene says something none of your verified facts back');
    expect(present('all-backed')).toBeFalse();
    expect(c.notes.value).toBe('');
  });

  it('says every scene is backed when none is flagged, and marks a test-mode script as test data', () => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: version() }));
    expect(present('all-backed')).toBeTrue();
    expect(present('sim')).toBeFalse();
    fixture.destroy();
    TestBed.resetTestingModule();

    render([summary({ status: 'Scripted' })], detail({ currentVersion: version({ isSimulated: true, flagged: 2 }) }));
    expect(present('sim')).toBeTrue();
    expect(present('all-backed')).toBeFalse();
  });

  it('edits a scene and shows the new check; cancel leaves it alone', () => {
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: version() }));
    api.updateScene.and.returnValue(of(version({ flagged: 1, scenes: [scene({ narration: 'We are open all night.', claimStatus: 'Unsupported', claimNote: 'No fact.', editedByTenant: true }), scene({ id: 's2', order: 2, narration: 'Book your visit today.', claimStatus: 'NoClaim', facts: [] })] })));

    root().querySelector<HTMLElement>('[data-scene="s1"] [data-testid="edit-scene"]')!.click();
    fixture.detectChanges();
    expect(c.editingSceneId).toBe('s1');
    expect(root().querySelector<HTMLTextAreaElement>('[data-testid="narration"]')!.value).toBe('We are open Monday to Saturday.');

    c.cancelEdit();
    fixture.detectChanges();
    expect(c.editingSceneId).toBeNull();
    expect(api.updateScene).not.toHaveBeenCalled();

    c.editScene(c.version!.scenes[0]);
    c.sceneForm.patchValue({ narration: '  We are open all night.  ', onScreenText: '', visualHint: '' });
    fixture.detectChanges();
    click('save-scene');

    expect(api.updateScene).toHaveBeenCalledWith('s1', { narration: 'We are open all night.', onScreenText: null, durationSeconds: 8, visualHint: null });
    expect(text('[data-scene="s1"]')).toContain('Edited by you');
    expect(text('[data-scene="s1"] [data-testid="claim"]')).toBe('No fact behind it');
    expect(c.editingSceneId).toBeNull();
  });

  it('removes a scene only after the tenant confirms', () => {
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: version() }));
    api.deleteScene.and.returnValue(of(version({ scenes: [scene({ id: 's2', order: 1, narration: 'Book your visit today.', claimStatus: 'NoClaim', facts: [] })] })));

    dialogResult = false;
    c.deleteScene(c.version!.scenes[0]);
    expect(api.deleteScene).not.toHaveBeenCalled();

    dialogResult = true;
    c.deleteScene(c.version!.scenes[0]);
    fixture.detectChanges();
    expect(api.deleteScene).toHaveBeenCalledWith('s1');
    expect(root().querySelectorAll('[data-scene]').length).toBe(1);
  });

  it('checks the script against the facts again', () => {
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: version() }));
    api.recheck.and.returnValue(of(version({ flagged: 1, supported: 1 })));

    click('recheck');

    expect(api.recheck).toHaveBeenCalledWith('v1');
    expect(c.version!.flagged).toBe(1);
    expect(notify.success).toHaveBeenCalled();
  });

  it('opens an earlier version, and a script that is no longer a draft cannot be edited', () => {
    const older = version({ id: 'v1', number: 1 });
    const newest = version({ id: 'v2', number: 2 });
    const c = render([summary({ status: 'Scripted' })], detail({
      versions: [
        { id: 'v2', number: 2, topicTitle: 'T', status: 'Draft', isSimulated: false, sceneCount: 2, totalSeconds: 16, createdAt: '' },
        { id: 'v1', number: 1, topicTitle: 'T', status: 'InReview', isSimulated: false, sceneCount: 2, totalSeconds: 16, createdAt: '' },
      ],
      currentVersion: newest,
    }));
    api.getVersion.and.returnValue(of({ ...older, status: 'InReview' }));
    expect(c.isNewestVersion).toBeTrue();
    expect(present('edit-scene')).toBeTrue();

    root().querySelector<HTMLElement>('[data-version="v1"]')!.click();
    fixture.detectChanges();

    expect(api.getVersion).toHaveBeenCalledWith('v1');
    expect(c.version!.number).toBe(1);
    expect(present('edit-scene')).toBeFalse();
    expect(root().textContent).toContain('no longer a draft');
  });

  it('deletes a project after confirmation and moves to the next one', () => {
    const c = render([summary(), summary({ id: 'p2', title: 'Second' })], detail());
    api.remove.and.returnValue(of(undefined));
    api.list.and.returnValue(of([summary({ id: 'p2', title: 'Second' })])); // what the server lists once p1 is gone
    api.get.and.returnValue(of(detail({ id: 'p2', title: 'Second' })));

    click('delete-project');

    expect(api.remove).toHaveBeenCalledWith('p1');
    expect(c.projects.map((p) => p.id)).toEqual(['p2']);
    expect(c.selectedId).toBe('p2');
  });
});
