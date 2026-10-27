import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import {
  AssetCandidates,
  AssetSummary,
  ContentScene,
  ContentTopic,
  ProjectDetail,
  ProjectSummary,
  ScriptVersion,
  StockPhoto,
  StudioAsset,
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
  facts: [{ id: 'f1', category: 'Services', statement: 'The clinic is open Monday to Saturday.' }], asset: null, ...over,
});

const summaryAsset = (over: Partial<AssetSummary> = {}): AssetSummary => ({
  id: 'a1', kind: 'Upload', kindLabel: 'Your upload', name: 'Reception', licenseName: 'Provided by you', attribution: null, width: 800, height: 600, ...over,
});

const studioAsset = (over: Partial<StudioAsset> = {}): StudioAsset => ({
  ...summaryAsset(), description: null, tags: ['reception'], contentType: 'image/png', sizeBytes: 1000, provider: null, licenseUrl: null, sourceUrl: null, rightsConfirmed: true,
  personalDataChecked: false, usedInScenes: 0, createdAt: '2026-10-27T10:00:00Z', ...over,
});

const stockPhoto = (over: Partial<StockPhoto> = {}): StockPhoto => ({
  providerAssetId: '1001', provider: 'Pexels', previewUrl: 'https://images.pexels.com/photos/1001/m.jpg', pageUrl: 'https://www.pexels.com/photo/1001/', photographer: 'Jane Doe', width: 1880, height: 1253,
  description: 'A clinic reception', licenseName: 'Pexels License', licenseUrl: 'https://www.pexels.com/license/', attribution: 'Photo by Jane Doe on Pexels', ...over,
});

const candidates = (over: Partial<AssetCandidates> = {}): AssetCandidates => ({
  query: 'reception desk', own: [{ asset: studioAsset(), score: 0.5, reason: 'Matches: reception' }], stock: [], stockAvailable: true, stockMessage: null, ...over,
});

const version = (over: Partial<ScriptVersion> = {}): ScriptVersion => ({
  id: 'v1', projectId: 'p1', number: 1, topicId: 't1', topicTitle: 'Why cataract surgery is quick', status: 'Draft', targetSeconds: 45, totalSeconds: 16, notes: null, provider: 'OpenAI', model: 'gpt',
  promptVersion: 'planner-v1', isSimulated: false, activityId: null, createdAt: '2026-10-27T10:05:00Z', supported: 2, flagged: 0, scenesWithoutPicture: 2,
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
    api = jasmine.createSpyObj('ContentPlannerService', ['list', 'create', 'get', 'update', 'remove', 'generateTopics', 'updateTopic', 'generateScript', 'getVersion', 'recheck', 'updateScene', 'deleteScene', 'candidates', 'chooseAsset', 'clearAsset', 'uploadAsset', 'assetContent']);
    api.assetContent.and.returnValue(of(new Blob(['x'], { type: 'image/png' })));
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

  // ----- pictures ------------------------------------------------------------------------------------------------------------

  function openPickerOnFirstScene(): StudioPlannerComponent {
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: version() }));
    api.candidates.and.returnValue(of(candidates()));
    root().querySelector<HTMLElement>('[data-scene="s1"] [data-testid="choose-picture"]')!.click();
    fixture.detectChanges();
    return c;
  }

  it('says how many scenes have no picture and offers to choose one', () => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: version() }));

    expect(text('[data-testid="no-pictures"]')).toBe('2 of 2 scenes have no picture yet.');
    expect(present('choose-picture')).toBeTrue();
  });

  it('lists the tenant\'s own pictures for a scene with why each matches, then sets the one they choose and shows what it is and its licence', () => {
    const c = openPickerOnFirstScene();

    expect(api.candidates).toHaveBeenCalledWith('s1', false, null);
    expect(text('[data-own="a1"]')).toContain('Your upload');
    expect(text('[data-own="a1"]')).toContain('Matches: reception');
    expect(c.thumbs['a1']).toBeDefined(); // fetched through the API, shown from an object URL

    api.chooseAsset.and.returnValue(of(summaryAsset()));
    root().querySelector<HTMLElement>('[data-own="a1"] [data-testid="use-own"]')!.click();
    fixture.detectChanges();

    expect(api.chooseAsset).toHaveBeenCalledWith('s1', { assetId: 'a1', stockProviderAssetId: null });
    expect(present('picker')).toBeFalse();
    const scene1 = '[data-scene="s1"]';
    expect(text(scene1 + ' [data-testid="picture-kind"]')).toBe('Your upload');
    expect(text(scene1 + ' [data-testid="picture-license"]')).toBe('Provided by you');
    expect(text('[data-testid="no-pictures"]')).toBe('1 of 2 scenes have no picture yet.');
    expect(notify.success).toHaveBeenCalledWith('Picture chosen.');
  });

  it('shows a stock photo plainly as one, with its credit and licence, and copies it only when the tenant chooses it', () => {
    const c = openPickerOnFirstScene();
    api.candidates.and.returnValue(of(candidates({ stock: [stockPhoto()] })));

    root().querySelector<HTMLElement>('[data-testid="tab-stock"]')!.click();
    fixture.detectChanges();

    expect(api.candidates).toHaveBeenCalledWith('s1', true, 'reception desk'); // the scene's own picture note, already in the box
    expect(c.stockQuery.value).toBe('reception desk');
    expect(text('[data-stock="1001"]')).toContain('Stock photo (Pexels)');
    expect(text('[data-stock="1001"]')).toContain('Photo by Jane Doe on Pexels · Pexels License');
    expect(api.chooseAsset).not.toHaveBeenCalled();

    api.chooseAsset.and.returnValue(of(summaryAsset({ id: 'a2', kind: 'Stock', kindLabel: 'Stock photo (Pexels)', licenseName: 'Pexels License', attribution: 'Photo by Jane Doe on Pexels' })));
    root().querySelector<HTMLElement>('[data-stock="1001"] [data-testid="use-stock"]')!.click();
    fixture.detectChanges();

    expect(api.chooseAsset).toHaveBeenCalledWith('s1', { assetId: null, stockProviderAssetId: '1001' }); // only the id goes to the server
    expect(text('[data-scene="s1"] [data-testid="picture-kind"]')).toBe('Stock photo (Pexels)');
    expect(text('[data-scene="s1"] [data-testid="picture-license"]')).toBe('Pexels License · Photo by Jane Doe on Pexels');
  });

  it('searches stock with the tenant\'s own words and says so when stock is not set up', () => {
    const c = openPickerOnFirstScene();
    api.candidates.and.returnValue(of(candidates({ stockAvailable: false, stockMessage: 'Stock photo search is not set up on this platform yet. Your own pictures can still be used.' })));
    root().querySelector<HTMLElement>('[data-testid="tab-stock"]')!.click();
    fixture.detectChanges();

    expect(text('[data-testid="stock-message"]')).toContain('not set up');
    expect(root().querySelector<HTMLButtonElement>('[data-testid="stock-search"]')!.disabled).toBeTrue();

    api.candidates.and.returnValue(of(candidates({ stock: [stockPhoto()] })));
    c.stockQuery.setValue('  eye doctor  ');
    c.searchStock();
    expect(api.candidates).toHaveBeenCalledWith('s1', true, 'eye doctor');
  });

  it('accepts an upload only with a picture and the tenant\'s confirmation, and a screenshot needs the personal data check as well', () => {
    const c = openPickerOnFirstScene();
    root().querySelector<HTMLElement>('[data-testid="tab-upload"]')!.click();
    fixture.detectChanges();
    const uploadButton = () => root().querySelector<HTMLButtonElement>('[data-testid="upload"]')!;
    expect(uploadButton().disabled).toBeTrue();

    c.onFileChosen({ target: { files: [new File(['x'], 'doc.pdf', { type: 'application/pdf' })] } } as unknown as Event);
    fixture.detectChanges();
    expect(text('[data-testid="file-problem"]')).toContain('Only JPEG, PNG and WebP');

    c.onFileChosen({ target: { files: [new File(['x'], 'front.png', { type: 'image/png' })] } } as unknown as Event);
    fixture.detectChanges();
    expect(present('file-problem')).toBeFalse();
    expect(uploadButton().disabled).toBeTrue(); // not confirmed yet

    c.uploadForm.patchValue({ rights: true });
    fixture.detectChanges();
    expect(uploadButton().disabled).toBeFalse();

    c.uploadForm.patchValue({ kind: 'Screenshot' });
    fixture.detectChanges();
    expect(present('personal')).toBeTrue();
    expect(uploadButton().disabled).toBeTrue();
    c.uploadForm.patchValue({ personal: true });
    expect(c.canUpload).toBeTrue();
  });

  it('uploads the picture with its details and confirmations and shows the library again', () => {
    const c = openPickerOnFirstScene();
    api.uploadAsset.and.returnValue(of(studioAsset({ id: 'a9', name: 'Front desk' })));
    c.onFileChosen({ target: { files: [new File(['x'], 'front.png', { type: 'image/png' })] } } as unknown as Event);
    c.uploadForm.patchValue({ name: ' Front desk ', tags: 'reception', rights: true });
    c.setPickerTab('upload');

    c.upload();

    const form = api.uploadAsset.calls.mostRecent().args[0] as FormData;
    expect(form.get('kind')).toBe('Upload');
    expect(form.get('name')).toBe('Front desk');
    expect(form.get('tags')).toBe('reception');
    expect(form.get('rightsConfirmed')).toBe('true');
    expect(form.get('personalDataChecked')).toBe('false');
    expect((form.get('file') as File).name).toBe('front.png');
    expect(notify.success).toHaveBeenCalledWith('Picture added to your library.');
    expect(c.pickerTab).toBe('own');
    expect(api.candidates).toHaveBeenCalledTimes(2); // opened, then refreshed
  });

  it('takes a picture off a scene, and offers no picture controls once the script is no longer a draft', () => {
    const withPicture = version({ scenesWithoutPicture: 1, scenes: [scene({ asset: summaryAsset() }), scene({ id: 's2', order: 2, claimStatus: 'NoClaim', facts: [] })] });
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: withPicture }));
    api.clearAsset.and.returnValue(of(undefined));

    root().querySelector<HTMLElement>('[data-scene="s1"] [data-testid="clear-picture"]')!.click();
    fixture.detectChanges();

    expect(api.clearAsset).toHaveBeenCalledWith('s1');
    expect(c.version!.scenes[0].asset).toBeNull();
    expect(c.version!.scenesWithoutPicture).toBe(2);

    c.version = { ...c.version!, status: 'InReview' };
    fixture.detectChanges();
    expect(present('choose-picture')).toBeFalse();
    expect(present('change-picture')).toBeFalse();
  });
});
