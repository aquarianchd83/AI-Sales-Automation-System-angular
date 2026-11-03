import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import {
  CinematicScript,
  SceneVideoProviderKind,
  StoryCharacter,
  StoryCharacterOrigin,
  StoryCharacterVisibility,
  StoryClipScene,
  StoryJobStatus,
  StoryRender,
  StorySceneStatus,
  StoryProject,
  StoryProjectStatus,
  StoryScriptVersion,
} from '../../../core/models/story-studio.model';
import { NotificationService } from '../../../core/services/notification.service';
import { StoryStudioService } from '../../../core/services/story-studio.service';
import { SharedModule } from '../../../shared/shared.module';
import { StudioStoriesComponent } from './studio-stories.component';

const character = (id: string, name: string, over: Partial<StoryCharacter> = {}): StoryCharacter => ({
  id,
  name,
  description: null,
  personality: null,
  visualAttributes: `${name} look`,
  voicePreferences: null,
  origin: StoryCharacterOrigin.Uploaded,
  visibility: StoryCharacterVisibility.Private,
  isOwnedByTenant: true,
  rightsConfirmed: true,
  approvedReferenceId: null,
  referenceCount: 0,
  ...over,
});

const project = (over: Partial<StoryProject> = {}): StoryProject => ({
  id: 'p1',
  title: 'Guru Ji',
  topic: 'A couple argues',
  language: 'Hinglish',
  style: null,
  audience: null,
  moral: null,
  targetSeconds: 30,
  status: StoryProjectStatus.Draft,
  videoProvider: SceneVideoProviderKind.Simulator,
  budgetUsd: null,
  currentScriptVersionId: null,
  characterIds: ['c1'],
  createdAt: '2026-11-02T09:00:00Z',
  ...over,
});

const clip = (index: number, status: StorySceneStatus, over: Partial<StoryClipScene> = {}): StoryClipScene => ({
  id: `s${index}`,
  index,
  targetSeconds: 8,
  status,
  videoPrompt: `prompt ${index}`,
  dialogue: [],
  actualMilliseconds: null,
  error: null,
  flagReason: null,
  costUsd: 0,
  ...over,
});

const script = (simulated: boolean): StoryScriptVersion => {
  const body: CinematicScript = {
    title: 'Guru Ji ka nyay',
    description: 'd',
    hook: 'Why is dinner cold?',
    storySummary: 'summary',
    language: 'Hinglish',
    punchline: 'Chai pi lo',
    characters: [{ name: 'Guru Ji', visualDescription: 'sage', voiceInstructions: 'calm' }],
    scenes: [
      {
        index: 1,
        targetSeconds: 8,
        setting: 's',
        camera: 'Medium shot',
        transition: 'Cut',
        soundEffects: '',
        continuityNotes: '',
        videoPrompt: 'prompt one',
        dialogue: [{ speaker: 'Guru Ji', text: 'Shaant ho jao', expression: 'calm', subtitleText: 'Shaant ho jao', startMs: 500, endMs: 3000 }],
      },
    ],
  };
  return { id: 'v1', number: 1, status: 0, source: simulated ? 'Simulator' : 'OpenAI', contentHash: 'h', script: body, isSimulated: simulated, createdAt: '2026-11-02T09:00:00Z' };
};

describe('StudioStoriesComponent', () => {
  let fixture: ComponentFixture<StudioStoriesComponent>;
  let api: jasmine.SpyObj<StoryStudioService>;

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const click = (selector: string) => {
    (root().querySelector(selector) as HTMLElement).click();
    fixture.detectChanges();
  };

  function render(projects: StoryProject[] = [project()]): void {
    api = jasmine.createSpyObj('StoryStudioService', [
      'listProjects', 'listCharacters', 'createProject', 'getScript', 'generateScript', 'saveScript', 'approveScript',
      'getCostEstimate', 'setVideoProvider', 'listScenes', 'generateClips', 'regenerateScene', 'uploadClip', 'flagScene', 'listRenders', 'startRender', 'downloadVideo', 'downloadClip', 'generateCharacters', 'editDialogue', 'approveVideo', 'getUsage', 'getDiagnostics', 'getVideoSources', 'addVoiceOver', 'getPublishPack', 'recordPublication', 'createCharacter', 'uploadReference', 'approveReference', 'archiveCharacter',
    ]);
    api.listProjects.and.returnValue(of(projects));
    api.listCharacters.and.returnValue(of([character('c1', 'Guru Ji'), character('c2', 'Sunita', { approvedReferenceId: 'r1' })]));
    api.listScenes.and.returnValue(of([]));
    api.listRenders.and.returnValue(of([]));
    api.getDiagnostics.and.returnValue(of([]));
    api.getVideoSources.and.returnValue(of([]));
    api.getPublishPack.and.returnValue(of({ renderId: 'r1', platforms: [], published: [] }));
    api.getUsage.and.returnValue(of({ lines: [], totalUsd: 0, budgetUsd: null, wastedOnFailedUsd: 0 }));
    api.getCostEstimate.and.returnValue(of({ isKnown: false, clipUsd: 0, clipSeconds: 8, clips: 4, provider: 'Simulator', note: 'Free test clips.' }));

    TestBed.configureTestingModule({
      declarations: [StudioStoriesComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: StoryStudioService, useValue: api },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error']) },
      ],
    });
    fixture = TestBed.createComponent(StudioStoriesComponent);
    fixture.detectChanges();
  }

  it('lists the tenant stories with their status', () => {
    render();
    expect(text(root().querySelector('[data-project="p1"]'))).toContain('Guru Ji');
    expect(text(root().querySelector('[data-project="p1"]'))).toContain('Drafting script');
  });

  it('starts a new story with the character library and no way to continue without a title and topic', () => {
    render();
    click('[data-testid="new-story"]');

    expect(root().querySelector('[data-testid="brief"]')).not.toBeNull();
    expect(root().querySelector('[data-character="c1"]')).not.toBeNull();
    expect((root().querySelector('[data-testid="create-project"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('sends the chosen characters and video source when the story is created', () => {
    render();
    api.createProject.and.returnValue(of(project({ id: 'p2', characterIds: ['c2'] })));
    click('[data-testid="new-story"]');

    const c = fixture.componentInstance;
    c.brief.patchValue({ title: 'New', topic: 'Topic', videoProvider: SceneVideoProviderKind.FlowImport });
    c.toggleCharacter(c.characters[1]);
    fixture.detectChanges();
    click('[data-testid="create-project"]');

    const body = api.createProject.calls.mostRecent().args[0];
    expect(body.characterIds).toEqual(['c2']);
    expect(body.videoProvider).toBe(SceneVideoProviderKind.FlowImport);
    expect(c.selected?.id).toBe('p2');
  });

  it('marks a simulated script as test data, and blocks approval until edits are saved', () => {
    render();
    api.generateScript.and.returnValue(of(script(true)));
    click('[data-project="p1"]');
    click('[data-testid="generate"]');

    expect(root().querySelector('[data-testid="test-badge"]')).not.toBeNull();
    expect((root().querySelector('[data-testid="approve"]') as HTMLButtonElement).disabled).toBeFalse();

    fixture.componentInstance.draft!.scenes[0].dialogue[0].text = 'Changed';
    fixture.componentInstance.markDirty();
    fixture.detectChanges();

    expect((root().querySelector('[data-testid="approve"]') as HTMLButtonElement).disabled).toBeTrue();
    expect((root().querySelector('[data-testid="save-edits"]') as HTMLButtonElement).disabled).toBeFalse();
  });

  it('approves the script in place and says so', () => {
    render([project({ currentScriptVersionId: 'v1' })]);
    api.getScript.and.returnValue(of(script(false)));
    api.approveScript.and.returnValue(of([]));
    api.listScenes.and.returnValue(of([clip(1, StorySceneStatus.Pending)]));
    // After approving, the server reports the story as approved; the page reads it again.
    click('[data-project="p1"]');

    expect(root().querySelector('[data-testid="test-badge"]')).toBeNull();
    api.listProjects.and.returnValue(of([project({ status: StoryProjectStatus.ScriptApproved, currentScriptVersionId: 'v1' })]));
    click('[data-testid="approve"]');

    expect(api.approveScript).toHaveBeenCalledWith('p1');
    expect(fixture.componentInstance.selected?.status).toBe(StoryProjectStatus.ScriptApproved);
    expect(text(root().querySelector('[data-testid="approved"]'))).toContain('Script approved');
  });

  describe("clips", () => {
    const approved = (over: Partial<StoryProject> = {}) => project({ status: StoryProjectStatus.ScriptApproved, currentScriptVersionId: "v1", ...over });

    it("shows one card per scene with its status once the script is approved", () => {
      render([approved()]);
      api.getScript.and.returnValue(of(script(false)));
      api.listScenes.and.returnValue(of([clip(1, StorySceneStatus.Pending), clip(2, StorySceneStatus.Completed, { actualMilliseconds: 8000 })]));
      click("[data-project=\"p1\"]");

      expect(text(root().querySelector("[data-scene=\"1\"]"))).toContain("Not started");
      expect(text(root().querySelector("[data-scene=\"2\"]"))).toContain("Clip ready");
      expect(text(root().querySelector("[data-scene=\"2\"]"))).toContain("8.0s clip");
    });

    it("makes free test clips without asking for a cost confirmation", () => {
      render([approved()]);
      api.getScript.and.returnValue(of(script(false)));
      api.listScenes.and.returnValue(of([clip(1, StorySceneStatus.Pending)]));
      api.generateClips.and.returnValue(of([clip(1, StorySceneStatus.Queued)]));
      click("[data-project=\"p1\"]");

      expect(root().querySelector("[data-testid=\"confirm-cost\"]")).toBeNull();
      click("[data-testid=\"make-clips\"]");

      expect(api.generateClips).toHaveBeenCalledWith("p1", false);
    });

    it("will not make paid clips until the cost box is ticked", () => {
      render([approved({ videoProvider: SceneVideoProviderKind.Veo })]);
      api.getScript.and.returnValue(of(script(false)));
      api.getCostEstimate.and.returnValue(of({ isKnown: true, clipUsd: 0.96, clipSeconds: 8, clips: 4, provider: "Veo", note: "n" }));
      api.listScenes.and.returnValue(of([clip(1, StorySceneStatus.Pending), clip(2, StorySceneStatus.Pending)]));
      api.generateClips.and.returnValue(of([clip(1, StorySceneStatus.Queued), clip(2, StorySceneStatus.Queued)]));
      click("[data-project=\"p1\"]");

      expect(text(root().querySelector("[data-testid=\"confirm-cost\"]"))).toContain("1.92 USD");
      expect((root().querySelector("[data-testid=\"make-clips\"]") as HTMLButtonElement).disabled).toBeTrue();

      fixture.componentInstance.confirmCost = true;
      fixture.detectChanges();
      click("[data-testid=\"make-clips\"]");

      expect(api.generateClips).toHaveBeenCalledWith("p1", true);
    });

    it("offers an upload for each Flow scene and no make-clips button", () => {
      render([approved({ videoProvider: SceneVideoProviderKind.FlowImport })]);
      api.getScript.and.returnValue(of(script(false)));
      api.listScenes.and.returnValue(of([clip(1, StorySceneStatus.AwaitingImport)]));
      click("[data-project=\"p1\"]");

      expect(root().querySelector("[data-upload=\"1\"]")).not.toBeNull();
      expect(root().querySelector("[data-testid=\"make-clips\"]")).toBeNull();
    });

    it("flags a finished scene with a reason", () => {
      render([approved()]);
      api.getScript.and.returnValue(of(script(false)));
      api.listScenes.and.returnValue(of([clip(1, StorySceneStatus.Completed)]));
      api.flagScene.and.returnValue(of(clip(1, StorySceneStatus.Flagged)));
      click("[data-project=\"p1\"]");

      click("[data-flag=\"1\"]");
      fixture.componentInstance.flagReason = "Lips do not match";
      fixture.componentInstance.submitFlag(fixture.componentInstance.scenes[0]);

      expect(api.flagScene).toHaveBeenCalledWith("s1", "Lips do not match");
    });
  });

  describe("video", () => {
    const renderOf = (status: StoryJobStatus, over: Partial<StoryRender> = {}): StoryRender => ({
      id: "r1", status, error: null, problems: [], durationSeconds: null, hasVideo: false, createdAt: "2026-11-02T09:00:00Z", ...over,
    });
    const inReview = () => project({ status: StoryProjectStatus.InReview, currentScriptVersionId: "v1" });

    function open(renders: StoryRender[]): void {
      render([inReview()]);
      api.getScript.and.returnValue(of(script(false)));
      api.listScenes.and.returnValue(of([clip(1, StorySceneStatus.Completed, { actualMilliseconds: 8000 })]));
      api.listRenders.and.returnValue(of(renders));
      click("[data-project=\"p1\"]");
    }

    it("offers to put the video together once every scene has a clip, and starts it", () => {
      open([]);
      api.startRender.and.returnValue(of(renderOf(StoryJobStatus.Queued)));

      expect(text(root().querySelector("[data-testid=\"put-together\"]"))).toContain("Put the video together");
      click("[data-testid=\"put-together\"]");

      expect(api.startRender).toHaveBeenCalledWith("p1");
      expect(text(root().querySelector("[data-testid=\"render\"]"))).toContain("Being put together");
    });

    it("does not let a second render start while one is running", () => {
      open([renderOf(StoryJobStatus.Processing)]);

      expect((root().querySelector("[data-testid=\"put-together\"]") as HTMLButtonElement).disabled).toBeTrue();
    });

    it("shows a finished video with watch and download, and a failure with its reason", () => {
      open([renderOf(StoryJobStatus.Completed, { hasVideo: true, durationSeconds: 32 })]);

      expect(text(root().querySelector("[data-testid=\"render\"]"))).toContain("Ready");
      expect(text(root().querySelector("[data-testid=\"render\"]"))).toContain("32 seconds");
      expect(root().querySelector("[data-testid=\"play-final\"]")).not.toBeNull();
      expect(root().querySelector("[data-testid=\"download-final\"]")).not.toBeNull();
    });

    it("explains why a render failed", () => {
      open([renderOf(StoryJobStatus.Failed, { error: "A scene has no finished clip." })]);

      expect(text(root().querySelector("[data-testid=\"render\"]"))).toContain("A scene has no finished clip.");
      expect(root().querySelector("[data-testid=\"play-final\"]")).toBeNull();
    });
  });

  describe("review", () => {
    const inReview = () => project({ status: StoryProjectStatus.InReview, currentScriptVersionId: "v1" });
    const done: StoryRender = { id: "r1", status: StoryJobStatus.Completed, error: null, problems: [], durationSeconds: 32, hasVideo: true, createdAt: "2026-11-02T09:00:00Z" };

    function open(renders: StoryRender[]): void {
      render([inReview()]);
      api.getScript.and.returnValue(of(script(false)));
      api.listScenes.and.returnValue(of([clip(1, StorySceneStatus.Completed, { actualMilliseconds: 8000, dialogue: [{ speaker: "Guru Ji", text: "Shaant", startMs: 500, endMs: 3000 }] })]));
      api.listRenders.and.returnValue(of(renders));
      click("[data-project=\"p1\"]");
    }

    it("offers approval only once a render has finished", () => {
      open([]);
      expect(root().querySelector("[data-testid=\"approve-video\"]")).toBeNull();

      TestBed.resetTestingModule();
      open([done]);
      expect(root().querySelector("[data-testid=\"approve-video\"]")).not.toBeNull();
    });

    it("approves the video and says so", () => {
      open([done]);
      api.approveVideo.and.returnValue(of(project({ status: StoryProjectStatus.Approved, currentScriptVersionId: "v1" })));

      click("[data-testid=\"approve-video\"]");

      expect(api.approveVideo).toHaveBeenCalledWith("p1");
      expect(text(root().querySelector("[data-testid=\"video-approved\"]"))).toContain("Video approved");
    });

    it("saves a corrected subtitle when it is changed", () => {
      open([done]);
      api.editDialogue.and.returnValue(of(clip(1, StorySceneStatus.Completed)));
      const box = root().querySelector("[data-line=\"1-1\"]") as HTMLInputElement;

      box.value = "Shaant ho jao";
      box.dispatchEvent(new Event("change"));

      expect(api.editDialogue).toHaveBeenCalledWith("s1", 1, "Shaant ho jao");
    });

    it("shows what the story has cost, including attempts that failed", () => {
      render([inReview()]);
      api.getScript.and.returnValue(of(script(false)));
      api.getUsage.and.returnValue(of({ lines: [{ category: "Scene clips", jobs: 2, failed: 1, estimatedUsd: 1.92, actualUsd: 0.96 }], totalUsd: 1.92, budgetUsd: 10, wastedOnFailedUsd: 0.96 }));
      click("[data-project=\"p1\"]");

      const usage = text(root().querySelector("[data-testid=\"usage\"]"));
      expect(usage).toContain("1.92 USD");
      expect(usage).toContain("10.00 USD budget");
      expect(usage).toContain("0.96 USD went on attempts that failed");
    });

    it("creates the missing characters from the script with the cost box passed through", () => {
      render([project({ currentScriptVersionId: "v1" })]);
      api.getScript.and.returnValue(of(script(false)));
      api.generateCharacters.and.returnValue(of([]));
      click("[data-project=\"p1\"]");

      fixture.componentInstance.confirmPictures = true;
      click("[data-testid=\"make-characters\"]");

      expect(api.generateCharacters).toHaveBeenCalledWith("p1", true);
    });
  });

  describe('setup, voice and sharing', () => {
    it('lists what the host is missing so a failure is seen before a video is made', () => {
      render();
      api.getDiagnostics.and.returnValue(
        of([
          { key: 'ffmpeg', label: 'ffmpeg', ok: true, detail: 'Found.' },
          { key: 'font', label: 'Devanagari subtitle font', ok: false, detail: 'None found on this host.' },
        ]),
      );
      fixture.componentInstance.ngOnInit();
      fixture.detectChanges();

      const setup = text(root().querySelector('[data-testid="setup"]'));
      expect(setup).toContain('Devanagari subtitle font');
      expect(setup).not.toContain('ffmpeg:');
    });

    it('adds a voice-over to a finished scene and shows any timing warning', () => {
      render([project({ status: StoryProjectStatus.InReview, currentScriptVersionId: 'v1' })]);
      api.getScript.and.returnValue(of(script(false)));
      const scene = clip(1, StorySceneStatus.Completed, { actualMilliseconds: 8000, dialogue: [{ speaker: 'Guru Ji', text: 'Shaant', startMs: 500, endMs: 3000 }] });
      api.listScenes.and.returnValue(of([scene]));
      api.addVoiceOver.and.returnValue(of({ scene, warnings: ['The line takes 5.0s but was given 2.5s.'], provider: 'Simulator', costUsd: 0 }));
      click('[data-project="p1"]');

      click('[data-voice="1"]');

      expect(api.addVoiceOver).toHaveBeenCalledWith('s1', false);
      expect(text(root().querySelector('[data-scene="1"]'))).toContain('takes 5.0s but was given 2.5s');
    });

    it('shows the share pack for an approved video and saves where it was posted', () => {
      render([project({ status: StoryProjectStatus.Approved, currentScriptVersionId: 'v1' })]);
      api.getScript.and.returnValue(of(script(false)));
      api.listScenes.and.returnValue(of([clip(1, StorySceneStatus.Completed)]));
      api.listRenders.and.returnValue(
        of([{ id: 'r1', status: StoryJobStatus.Completed, error: null, problems: [], durationSeconds: 32, hasVideo: true, createdAt: '2026-11-03T09:00:00Z' }]),
      );
      api.getPublishPack.and.returnValue(
        of({
          renderId: 'r1',
          platforms: [{ platform: 0, title: 'Guru Ji ka nyay #Shorts', description: 'Ek jhagda', hashtags: ['#Shorts'], rules: ['Title up to 100 characters.'] }],
          published: [{ id: 'u1', platform: 2, url: 'https://www.instagram.com/reel/abc/', publishedAtUtc: '2026-11-03T09:00:00Z' }],
        }),
      );
      api.recordPublication.and.returnValue(of({ id: 'u2', platform: 0, url: 'https://youtube.com/shorts/x', publishedAtUtc: '2026-11-03T09:00:00Z' }));
      click('[data-project="p1"]');

      expect(text(root().querySelector('[data-platform="0"]'))).toContain('Guru Ji ka nyay #Shorts');
      expect(text(root().querySelector('[data-testid="published"]'))).toContain('Instagram Reels');

      fixture.componentInstance.publishUrls = { 0: 'https://youtube.com/shorts/x' };
      fixture.componentInstance.recordPublication(0);
      expect(api.recordPublication).toHaveBeenCalledWith('p1', 0, 'https://youtube.com/shorts/x');
    });
  });

  describe('clip sources', () => {
    const sources = (veoOpen: boolean) => [
      { kind: 0, available: true, reason: null },
      { kind: 1, available: veoOpen, reason: veoOpen ? null : 'Veo is not switched on for the studio.' },
      { kind: 2, available: true, reason: null },
    ];

    it('shows Veo as unavailable, with the reason, until the platform switches it on', () => {
      render();
      api.getVideoSources.and.returnValue(of(sources(false)));
      fixture.componentInstance.ngOnInit();
      click('[data-testid="new-story"]');

      const veo = root().querySelector('[data-source="1"]') as HTMLElement;
      expect(veo.querySelector('input')?.disabled).toBeTrue();
      expect(text(veo)).toContain('Veo is not switched on for the studio.');
      expect((root().querySelector('[data-source="0"] input') as HTMLInputElement).disabled).toBeFalse();
      expect((root().querySelector('[data-source="2"] input') as HTMLInputElement).disabled).toBeFalse();
    });

    it('lets Veo be chosen once it is switched on', () => {
      render();
      api.getVideoSources.and.returnValue(of(sources(true)));
      fixture.componentInstance.ngOnInit();
      click('[data-testid="new-story"]');

      expect((root().querySelector('[data-source="1"] input') as HTMLInputElement).disabled).toBeFalse();
    });
  });
});
