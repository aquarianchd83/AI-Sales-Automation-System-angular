import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import {
  AssetCandidates,
  AssetSummary,
  ConnectionsOverview,
  ContentScene,
  ContentTopic,
  ProjectDetail,
  ProjectSummary,
  Publication,
  RenderJob,
  ReviewState,
  ScriptVersion,
  StockPhoto,
  StudioAsset,
} from '../../../core/models/content-planner.model';
import { AuthService } from '../../../core/services/auth.service';
import { ContentPlannerService } from '../../../core/services/content-planner.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SharedModule } from '../../../shared/shared.module';
import { PUBLISH_POLL_MS, RENDER_POLL_MS, StudioPlannerComponent } from './studio-planner.component';

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

const renderJob = (over: Partial<RenderJob> = {}): RenderJob => ({
  id: 'r1', versionId: 'v1', versionNumber: 1, status: 'Queued', progress: 0, stage: 'Waiting for its turn', aspectRatio: '16:9', voiceGender: 'Female', renderer: 'Shotstack', isSimulated: false,
  isAiVoice: true, hasVideo: false, videoBytes: 0, videoSeconds: 0, error: null, flaggedScenes: 0, createdAt: '2026-10-27T11:00:00Z', startedAt: null, finishedAt: null, isOfApprovedScript: false, ...over,
});

const reviewState = (over: Partial<ReviewState> = {}): ReviewState => ({
  versionId: 'v1', status: 'Draft', submittedAt: null, submittedByEmail: null, reviewedAt: null, reviewedByEmail: null, reviewComment: null, canApprove: true, approvalIsAdminOnly: true,
  integrityOk: true, history: [], ...over,
});

const connectionsOverview = (over: Partial<ConnectionsOverview> = {}): ConnectionsOverview => ({
  youTubeAvailable: true, connections: [{ id: 'c1', platform: 'YouTube', accountName: 'Clinic Channel', status: 'Connected', lastError: null, connectedAt: '2026-10-20T10:00:00Z', lastUsedAt: null }], ...over,
});

const publication = (over: Partial<Publication> = {}): Publication => ({
  id: 'pub1', versionId: 'v1', versionNumber: 1, renderJobId: 'r1', platform: 'YouTube', accountName: 'Clinic Channel', status: 'Scheduled', title: 'Cataract surgery explained', description: null,
  privacy: 'private', scheduledAtUtc: null, url: null, attempts: 0, nextRetryAtUtc: null, lastError: null, createdAt: '2026-10-27T14:00:00Z', publishedAtUtc: null, ...over,
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
  let isAdmin = true;
  let accounts: ConnectionsOverview = connectionsOverview();
  let publications: Publication[] = [];

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (sel: string) => (root().querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const click = (testId: string) => {
    root().querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();
    fixture.detectChanges();
  };
  const present = (testId: string) => root().querySelector(`[data-testid="${testId}"]`) !== null;

  function render(projects: ProjectSummary[], first: ProjectDetail | null, jobs: RenderJob[] = [], review: ReviewState = reviewState()): StudioPlannerComponent {
    api = jasmine.createSpyObj('ContentPlannerService', ['list', 'create', 'get', 'update', 'remove', 'generateTopics', 'updateTopic', 'generateScript', 'getVersion', 'recheck', 'updateScene', 'deleteScene', 'candidates', 'chooseAsset', 'clearAsset', 'uploadAsset', 'assetContent', 'startRender', 'renders', 'render', 'cancelRender', 'video', 'review', 'submit', 'withdraw', 'approve', 'reject', 'revise', 'connections', 'publish', 'publications', 'cancelPublication', 'retryPublication']);
    api.connections.and.callFake(() => of(accounts));
    api.publications.and.callFake(() => of(publications));
    api.review.and.returnValue(of(review));
    api.renders.and.returnValue(of(jobs));
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
        { provide: AuthService, useValue: { hasAnyRole: () => isAdmin } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(dialogResult) }) } },
      ],
    });
    fixture = TestBed.createComponent(StudioPlannerComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    dialogResult = true;
    isAdmin = true;
    accounts = connectionsOverview();
    publications = [];
  });
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

  // ----- the video -----------------------------------------------------------------------------------------------------------

  const ready = () => version({ scenesWithoutPicture: 0, scenes: [scene({ asset: summaryAsset() }), scene({ id: 's2', order: 2, claimStatus: 'NoClaim', facts: [], asset: summaryAsset({ id: 'a2' }) })] });

  it('will not offer a video until every scene has a picture, and says how many are missing', () => {
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: version() }));

    expect(text('[data-testid="cannot-render"]')).toBe('2 of 2 scenes have no picture yet. Choose a picture for every scene first.');
    expect(root().querySelector<HTMLButtonElement>('[data-testid="make-video"]')!.disabled).toBeTrue();
    c.makeVideo();
    expect(api.startRender).not.toHaveBeenCalled();
  });

  it('will not make a video of a script from the platform\'s test mode', () => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: { ...ready(), isSimulated: true } }));

    expect(text('[data-testid="cannot-render"]')).toContain('test mode');
    expect(present('render-form')).toBeFalse();
  });

  it('starts a video with the chosen shape and voice, shows it queued, and warns that a flagged script is only a preview', () => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: { ...ready(), flagged: 1 } }));
    api.startRender.and.returnValue(of(renderJob()));
    expect(text('[data-testid="render-flagged"]')).toContain('it is not approved or published');
    fixture.componentInstance.videoOptions.patchValue({ aspect: '9:16', voice: 'Male' });

    click('make-video');

    expect(api.startRender).toHaveBeenCalledWith('v1', '9:16', 'Male');
    expect(text('[data-testid="render-status"]')).toBe('Queued');
    expect(text('[data-testid="render-stage"]')).toBe('Waiting for its turn');
    expect(present('render-progress')).toBeTrue();
    expect(root().querySelector<HTMLButtonElement>('[data-testid="make-video"]')!.disabled).toBeTrue(); // one at a time
    expect(text('[data-testid="cannot-render"]')).toContain('already being made');
    discardPeriodicTasks;
  });

  it('follows a running video until it is ready, tells the tenant, and plays it from the API with the AI-voice disclosure', fakeAsync(() => {
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: ready() }), [renderJob({ status: 'Rendering', progress: 50, stage: 'Making the video' })]);
    expect(text('[data-testid="render-status"]')).toBe('Rendering');
    api.render.and.returnValue(of(renderJob({ status: 'Succeeded', progress: 100, stage: 'Your video is ready', hasVideo: true, videoBytes: 5, videoSeconds: 14 })));
    api.video.and.returnValue(of(new Blob(['mp4'], { type: 'video/mp4' })));

    tick(RENDER_POLL_MS);
    fixture.detectChanges();

    expect(api.render).toHaveBeenCalledWith('r1');
    expect(notify.success).toHaveBeenCalledWith('Your video is ready.');
    expect(text('[data-testid="render-status"]')).toBe('Succeeded');
    expect(text('[data-testid="render-ai-voice"]')).toBe('AI voice');
    expect(present('render-progress')).toBeFalse();

    click('watch');
    expect(api.video).toHaveBeenCalledWith('r1');
    expect(present('player')).toBeTrue();
    expect(c.videoUrl).toMatch(/^blob:/);
    click('close-video');
    expect(present('player')).toBeFalse();
    expect(c.videoUrl).toBeNull();

    tick(RENDER_POLL_MS * 3); // nothing is running any more: no more asking
    expect(api.render).toHaveBeenCalledTimes(1);
    discardPeriodicTasks();
  }));

  it('shows why a video failed in the tenant\'s words, and that a test render made no video', fakeAsync(() => {
    const jobs = [
      renderJob({ id: 'r2', status: 'Succeeded', isSimulated: true, isAiVoice: false, stage: 'Test render finished - the platform is in test mode, so no video was made' }),
      renderJob({ status: 'Failed', error: 'The voice service rejected the platform\'s key. Nothing was charged - try again.', stage: 'Could not make the video' }),
    ];
    render([summary({ status: 'Scripted' })], detail({ currentVersion: ready() }), jobs);

    expect(text('[data-render="r1"] [data-testid="render-error"]')).toContain('Nothing was charged');
    expect(text('[data-render="r2"] [data-testid="render-test"]')).toBe('Test render - no video');
    expect(root().querySelector('[data-render="r2"] [data-testid="watch"]')).toBeNull(); // no video is pretended
    expect(root().querySelector('[data-render="r2"] [data-testid="render-ai-voice"]')).toBeNull();
    expect(root().querySelector<HTMLButtonElement>('[data-testid="make-video"]')!.disabled).toBeFalse();
    discardPeriodicTasks();
  }));

  it('cancels a running video', fakeAsync(() => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: ready() }), [renderJob({ status: 'Rendering', progress: 50 })]);
    api.cancelRender.and.returnValue(of(renderJob({ status: 'Cancelled', stage: 'Cancelled by you' })));

    click('cancel-render');

    expect(api.cancelRender).toHaveBeenCalledWith('r1');
    expect(text('[data-testid="render-status"]')).toBe('Cancelled');
    expect(notify.success).toHaveBeenCalledWith('Video cancelled.');
    discardPeriodicTasks();
  }));

  it('loads the videos of the version that is on show, and again when another version is opened', () => {
    const c = render([summary({ status: 'Scripted' })], detail({
      versions: [{ id: 'v2', number: 2, topicTitle: 'T', status: 'Draft', isSimulated: false, sceneCount: 2, totalSeconds: 16, createdAt: '' }, { id: 'v1', number: 1, topicTitle: 'T', status: 'Draft', isSimulated: false, sceneCount: 2, totalSeconds: 16, createdAt: '' }],
      currentVersion: { ...ready(), id: 'v2', number: 2 },
    }));
    expect(api.renders).toHaveBeenCalledWith('v2');
    api.getVersion.and.returnValue(of({ ...ready(), id: 'v1', number: 1 }));

    root().querySelector<HTMLElement>('[data-version="v1"]')!.click();
    fixture.detectChanges();

    expect(api.renders).toHaveBeenCalledWith('v1');
    expect(c.renders).toEqual([]);
  });

  // ----- review and approval ---------------------------------------------------------------------------------------------------

  const readyScript = () => version({ scenesWithoutPicture: 0, scenes: [scene({ asset: summaryAsset() }), scene({ id: 's2', order: 2, claimStatus: 'NoClaim', facts: [], asset: summaryAsset({ id: 'a2' }) })] });

  it('shows a draft as not sent yet and says what stops it being sent', () => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: version() }));

    expect(text('[data-testid="review-status"]')).toBe('Draft - not sent yet');
    expect(text('[data-testid="cannot-submit"]')).toContain('have no picture yet');
    expect(root().querySelector<HTMLButtonElement>('[data-testid="submit"]')!.disabled).toBeTrue();
    fixture.destroy();
    TestBed.resetTestingModule();

    render([summary({ status: 'Scripted' })], detail({ currentVersion: { ...readyScript(), flagged: 1 } }));
    expect(text('[data-testid="cannot-submit"]')).toContain('says something none of your verified facts back');
  });

  it('sends a ready draft for approval with a note, after which it can no longer be edited here', () => {
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: readyScript() }));
    api.submit.and.returnValue(of(reviewState({ status: 'InReview', submittedAt: '2026-10-27T12:00:00Z', submittedByEmail: 'sales@clinic.example' })));
    expect(present('cannot-submit')).toBeFalse();
    expect(present('edit-scene')).toBeTrue();
    c.reviewNote.setValue('  Please check the hours.  ');

    click('submit');

    expect(api.submit).toHaveBeenCalledWith('v1', 'Please check the hours.');
    expect(text('[data-testid="review-status"]')).toBe('Waiting for approval');
    expect(root().textContent).toContain('Sent by sales@clinic.example');
    expect(c.version!.status).toBe('InReview');
    expect(present('edit-scene')).toBeFalse(); // frozen while it is looked at
    expect(c.detail!.versions[0]?.status ?? 'InReview').toBe('InReview');
    expect(notify.success).toHaveBeenCalledWith('Sent for approval.');
  });

  it('lets someone who may approve approve with a note, and freezes the script', () => {
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: { ...readyScript(), status: 'InReview' } }), [], reviewState({ status: 'InReview', canApprove: true }));
    api.approve.and.returnValue(of(reviewState({ status: 'Approved', reviewedAt: '2026-10-27T13:00:00Z', reviewedByEmail: 'admin@clinic.example', reviewComment: 'Good.' })));
    c.reviewNote.setValue('Good.');

    click('approve');

    expect(api.approve).toHaveBeenCalledWith('v1', 'Good.');
    expect(text('[data-testid="review-status"]')).toBe('Approved');
    expect(root().textContent).toContain('Approved by admin@clinic.example');
    expect(text('[data-testid="review-comment"]')).toBe('Note: Good.');
    expect(root().textContent).toContain('frozen exactly as it was approved');
    expect(present('revise')).toBeTrue();
    expect(present('approve')).toBeFalse();
  });

  it('sends a script back only with a reason', () => {
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: { ...readyScript(), status: 'InReview' } }), [], reviewState({ status: 'InReview' }));
    api.reject.and.returnValue(of(reviewState({ status: 'Rejected', reviewComment: 'Too long for Reels.' })));

    click('reject-start');
    expect(root().querySelector<HTMLButtonElement>('[data-testid="reject-confirm"]')!.disabled).toBeTrue(); // no reason yet
    c.reviewNote.setValue('   ');
    fixture.detectChanges();
    expect(c.canConfirmReject).toBeFalse();
    c.reviewNote.setValue('  Too long for Reels.  ');
    fixture.detectChanges();

    click('reject-confirm');

    expect(api.reject).toHaveBeenCalledWith('v1', 'Too long for Reels.');
    expect(text('[data-testid="review-status"]')).toBe('Rejected');
    expect(text('[data-testid="review-comment"]')).toBe('Reason: Too long for Reels.');
    expect(c.rejecting).toBeFalse();
  });

  it('offers no approving to someone who may not, says why, and still lets the sender take it back', () => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: { ...readyScript(), status: 'InReview' } }), [], reviewState({ status: 'InReview', canApprove: false, approvalIsAdminOnly: true }));
    api.withdraw.and.returnValue(of(reviewState({ status: 'Draft' })));

    expect(text('[data-testid="cannot-approve"]')).toContain('Only an Admin can approve content.');
    expect(present('approve')).toBeFalse();
    expect(present('reject-start')).toBeFalse();

    click('withdraw');

    expect(api.withdraw).toHaveBeenCalledWith('v1', null);
    expect(text('[data-testid="review-status"]')).toBe('Draft - not sent yet');
    expect(present('edit-scene')).toBeTrue(); // editable again
  });

  it('warns loudly when an approved script no longer matches what was approved', () => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: { ...readyScript(), status: 'Approved' } }), [], reviewState({ status: 'Approved', integrityOk: false }));

    expect(text('[data-testid="integrity-warning"]')).toContain('no longer matches what was approved');
  });

  it('starts a new draft from an approved script and shows it, leaving the approved one alone', () => {
    const c = render([summary({ status: 'Scripted' })], detail({ currentVersion: { ...readyScript(), status: 'Approved' } }), [], reviewState({ status: 'Approved' }));
    const newer = { ...readyScript(), id: 'v2', number: 2 };
    api.revise.and.returnValue(of(detail({ currentVersion: newer, versions: [{ id: 'v2', number: 2, topicTitle: 'T', status: 'Draft', isSimulated: false, sceneCount: 2, totalSeconds: 16, createdAt: '' }, { id: 'v1', number: 1, topicTitle: 'T', status: 'Approved', isSimulated: false, sceneCount: 2, totalSeconds: 16, createdAt: '' }] })));
    api.review.and.returnValue(of(reviewState({ versionId: 'v2', status: 'Draft' })));

    click('revise');

    expect(api.revise).toHaveBeenCalledWith('v1');
    expect(c.version!.number).toBe(2);
    expect(text('[data-testid="review-status"]')).toBe('Draft - not sent yet');
    expect(notify.success).toHaveBeenCalledWith('New draft (version 2) started. The earlier script is unchanged.');
  });

  it('lists the history of the script in plain words', () => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: readyScript() }), [], reviewState({
      history: [
        { id: 'e1', action: 'Submitted', fromStatus: 'Draft', toStatus: 'InReview', actorEmail: 'sales@clinic.example', comment: 'Please check.', at: '2026-10-27T12:00:00Z' },
        { id: 'e2', action: 'Rejected', fromStatus: 'InReview', toStatus: 'Rejected', actorEmail: 'admin@clinic.example', comment: 'Shorten it.', at: '2026-10-27T13:00:00Z' },
      ],
    }));

    const history = text('[data-testid="history"]');
    expect(history).toContain('History (2)');
    expect(history).toContain('Sent for approval');
    expect(history).toContain('Sent back');
    expect(history).toContain('Shorten it.');
  });

  it('marks a video made from exactly the approved script', () => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: { ...readyScript(), status: 'Approved' } }), [renderJob({ status: 'Succeeded', hasVideo: true, isOfApprovedScript: true })], reviewState({ status: 'Approved' }));

    expect(text('[data-testid="render-approved"]')).toBe('Of the approved script');
  });

  it('asks for the review of the version on show, and again when another version is opened', () => {
    render([summary({ status: 'Scripted' })], detail({
      versions: [{ id: 'v2', number: 2, topicTitle: 'T', status: 'Draft', isSimulated: false, sceneCount: 2, totalSeconds: 16, createdAt: '' }, { id: 'v1', number: 1, topicTitle: 'T', status: 'Draft', isSimulated: false, sceneCount: 2, totalSeconds: 16, createdAt: '' }],
      currentVersion: { ...readyScript(), id: 'v2', number: 2 },
    }));
    expect(api.review).toHaveBeenCalledWith('v2');
    api.getVersion.and.returnValue(of({ ...readyScript(), id: 'v1', number: 1 }));

    root().querySelector<HTMLElement>('[data-version="v1"]')!.click();
    fixture.detectChanges();

    expect(api.review).toHaveBeenCalledWith('v1');
  });

  // ----- publishing ------------------------------------------------------------------------------------------------------------

  const approvedVersion = () => ({ ...readyScript(), status: 'Approved' as const });
  const approvedReview = () => reviewState({ status: 'Approved', integrityOk: true });
  const approvedVideo = () => [renderJob({ status: 'Succeeded', hasVideo: true, isOfApprovedScript: true })];

  function renderApproved(): StudioPlannerComponent {
    return render([summary({ status: 'Scripted' })], detail({ currentVersion: approvedVersion() }), approvedVideo(), approvedReview());
  }

  it('shows publishing only to an Admin, only for an approved script that still matches what was approved', () => {
    isAdmin = false;
    render([summary({ status: 'Scripted' })], detail({ currentVersion: approvedVersion() }), approvedVideo(), approvedReview());
    expect(present('publishing')).toBeFalse();
    expect(api.connections).not.toHaveBeenCalled();
    fixture.destroy();
    TestBed.resetTestingModule();

    isAdmin = true;
    render([summary({ status: 'Scripted' })], detail({ currentVersion: readyScript() }), [], reviewState({ status: 'Draft' }));
    expect(present('publishing')).toBeFalse(); // not approved
    fixture.destroy();
    TestBed.resetTestingModule();

    render([summary({ status: 'Scripted' })], detail({ currentVersion: approvedVersion() }), approvedVideo(), reviewState({ status: 'Approved', integrityOk: false }));
    expect(present('publishing')).toBeFalse(); // changed after approval
  });

  it('says what is missing: a video of the approved script, or a connected account', () => {
    render([summary({ status: 'Scripted' })], detail({ currentVersion: approvedVersion() }), [renderJob({ status: 'Succeeded', hasVideo: true, isOfApprovedScript: false })], approvedReview());
    expect(text('[data-testid="cannot-publish"]')).toContain('Make a video from this approved script first');
    expect(present('publish-form')).toBeFalse();
    fixture.destroy();
    TestBed.resetTestingModule();

    accounts = connectionsOverview({ connections: [] });
    render([summary({ status: 'Scripted' })], detail({ currentVersion: approvedVersion() }), approvedVideo(), approvedReview());
    expect(text('[data-testid="cannot-publish"]')).toContain('No YouTube account is connected');
  });

  it('publishes after the Admin confirms, privately by default, with a key that makes a second press the same publication', () => {
    const c = renderApproved();
    expect(c.publishForm.controls.connectionId.value).toBe('c1');
    expect(c.publishForm.controls.title.value).toBe('Cataract awareness');
    expect(c.publishForm.controls.privacy.value).toBe('private');
    api.publish.and.returnValues(throwError(() => new Error('network')), of(publication()));
    c.publishForm.patchValue({ title: '  Cataract surgery explained  ', description: '  A short explainer.  ' });
    fixture.detectChanges();

    dialogResult = false;
    click('publish');
    expect(api.publish).not.toHaveBeenCalled(); // not confirmed

    dialogResult = true;
    click('publish'); // fails
    click('publish'); // again

    expect(api.publish).toHaveBeenCalledTimes(2);
    const [versionId, first] = api.publish.calls.argsFor(0);
    const second = api.publish.calls.argsFor(1)[1];
    expect(versionId).toBe('v1');
    expect(first).toEqual(jasmine.objectContaining({ renderJobId: 'r1', connectionId: 'c1', title: 'Cataract surgery explained', description: 'A short explainer.', privacy: 'private', scheduledAtUtc: null }));
    expect(first.idempotencyKey).toBeTruthy();
    expect(second.idempotencyKey).toBe(first.idempotencyKey); // the same click, retried
    expect(text('[data-publication="pub1"] [data-testid="publication-status"]')).toBe('Scheduled');
    expect(notify.success).toHaveBeenCalledWith('Sending to YouTube. This takes a few minutes.');

    // The next, separate publication gets a new key.
    c.publishForm.patchValue({ title: 'Another' });
    api.publish.and.returnValue(of(publication({ id: 'pub2' })));
    publications = [];
    click('publish');
    expect(api.publish.calls.mostRecent().args[1].idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it('needs a date and time to schedule, and sends it as UTC', () => {
    const c = renderApproved();
    api.publish.and.returnValue(of(publication({ scheduledAtUtc: '2027-01-01T04:30:00Z' })));
    c.publishForm.patchValue({ when: 'later' });
    fixture.detectChanges();
    expect(c.canPublish).toBeFalse();

    c.publishForm.patchValue({ at: '2027-01-01T10:00' });
    fixture.detectChanges();
    expect(c.canPublish).toBeTrue();
    click('publish');

    expect(api.publish.calls.mostRecent().args[1].scheduledAtUtc).toBe(new Date('2027-01-01T10:00').toISOString());
    expect(notify.success).toHaveBeenCalledWith('Scheduled.');
  });

  it('shows where a publication stands, links to the post, and follows a sending one until it is on YouTube', fakeAsync(() => {
    publications = [publication({ status: 'Uploading' })];
    renderApproved();
    expect(text('[data-testid="publication-status"]')).toBe('Sending');
    publications = [publication({ status: 'Published', url: 'https://www.youtube.com/watch?v=abc', publishedAtUtc: '2027-01-01T04:30:00Z' })];

    tick(PUBLISH_POLL_MS);
    fixture.detectChanges();

    expect(text('[data-testid="publication-status"]')).toBe('Published');
    expect(root().querySelector<HTMLAnchorElement>('[data-testid="publication-link"]')!.href).toBe('https://www.youtube.com/watch?v=abc');
    expect(notify.success).toHaveBeenCalledWith('Published to YouTube.');
    tick(PUBLISH_POLL_MS * 3);
    expect(api.publications).toHaveBeenCalledTimes(2); // stopped asking
    discardPeriodicTasks();
  }));

  it('cancels a waiting publication and tries a failed one again, asking first when the video may already be there', () => {
    publications = [publication({ id: 'w', status: 'Scheduled', scheduledAtUtc: '2027-01-01T04:30:00Z' }), publication({ id: 'f', status: 'Failed', lastError: 'Contact was lost while the video was being sent, so it may or may not be on YouTube. Look at your channel before trying again.' })];
    renderApproved();
    api.cancelPublication.and.returnValue(of(publication({ id: 'w', status: 'Cancelled' })));
    api.retryPublication.and.returnValue(of(publication({ id: 'f', status: 'Scheduled' })));

    click('cancel-publication');
    expect(api.cancelPublication).toHaveBeenCalledWith('w');
    expect(text('[data-publication="w"] [data-testid="publication-status"]')).toBe('Cancelled');
    expect(text('[data-publication="f"] [data-testid="publication-error"]')).toContain('may or may not be on YouTube');

    dialogResult = false;
    click('retry-publication');
    expect(api.retryPublication).not.toHaveBeenCalled(); // the warning was not accepted

    dialogResult = true;
    click('retry-publication');
    expect(api.retryPublication).toHaveBeenCalledWith('f');
    expect(text('[data-publication="f"] [data-testid="publication-status"]')).toBe('Scheduled');
  });
});
