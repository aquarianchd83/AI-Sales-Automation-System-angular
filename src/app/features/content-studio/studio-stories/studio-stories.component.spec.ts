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
      'getCostEstimate', 'setVideoProvider', 'createCharacter', 'uploadReference', 'approveReference', 'archiveCharacter',
    ]);
    api.listProjects.and.returnValue(of(projects));
    api.listCharacters.and.returnValue(of([character('c1', 'Guru Ji'), character('c2', 'Sunita', { approvedReferenceId: 'r1' })]));
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
    click('[data-project="p1"]');

    expect(root().querySelector('[data-testid="test-badge"]')).toBeNull();
    click('[data-testid="approve"]');

    expect(api.approveScript).toHaveBeenCalledWith('p1');
    expect(fixture.componentInstance.selected?.status).toBe(StoryProjectStatus.ScriptApproved);
    expect(text(root().querySelector('[data-testid="approved"]'))).toContain('Script approved');
  });
});
