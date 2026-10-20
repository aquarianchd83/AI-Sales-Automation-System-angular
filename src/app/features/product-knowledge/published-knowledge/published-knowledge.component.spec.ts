import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { KnowledgeVersion, KnowledgeVersionDetail, KnowledgeVersionsOverview } from '../../../core/models/published-knowledge.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PublishedKnowledgeService } from '../../../core/services/published-knowledge.service';
import { SharedModule } from '../../../shared/shared.module';
import { PublishedKnowledgeComponent } from './published-knowledge.component';

const version = (over: Partial<KnowledgeVersion> = {}): KnowledgeVersion => ({
  id: 'v2',
  number: 2,
  status: 'Current',
  publishedAt: '2026-10-19T09:00:00Z',
  publishedByEmail: 'owner@clinic.example',
  itemCount: 3,
  note: 'New pricing',
  restoredFromNumber: null,
  ...over,
});

const overview = (over: Partial<KnowledgeVersionsOverview['preview']> = {}, versions = [version(), version({ id: 'v1', number: 1, status: 'Superseded', note: null })]): KnowledgeVersionsOverview => ({
  preview: { ready: 3, heldBack: [], notYetApproved: 2, nothingNew: false, current: versions[0] ?? null, ...over },
  versions,
});

const detail = (v = version()): KnowledgeVersionDetail => ({
  version: v,
  items: [
    {
      id: 'i1',
      category: 'Pricing',
      question: 'What does it cost?',
      summary: 'The fee is Rs 500.',
      detail: 'Per visit.',
      kind: 'SourceExtracted',
      confidence: 'High',
      isMaterialClaim: true,
      approvedAt: '2026-10-18T09:00:00Z',
      reviewDueAt: '2027-04-16T09:00:00Z',
      evidence: [{ sourceId: 's', sourceName: 'brochure.pdf', location: 'Page 2', heading: null, excerpt: 'fee is Rs 500' }],
    },
  ],
});

describe('PublishedKnowledgeComponent', () => {
  let fixture: ComponentFixture<PublishedKnowledgeComponent>;
  let service: jasmine.SpyObj<PublishedKnowledgeService>;
  let dialog: jasmine.SpyObj<MatDialog>;
  let notify: jasmine.SpyObj<NotificationService>;

  const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;

  function create(o: KnowledgeVersionsOverview = overview()): PublishedKnowledgeComponent {
    service.get.and.returnValue(of(o));
    fixture = TestBed.createComponent(PublishedKnowledgeComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(async () => {
    service = jasmine.createSpyObj('PublishedKnowledgeService', ['get', 'getVersion', 'publish', 'restore', 'draftFile', 'finalFile']);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error']);
    service.getVersion.and.returnValue(of(detail()));
    await TestBed.configureTestingModule({
      declarations: [PublishedKnowledgeComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: PublishedKnowledgeService, useValue: service },
        { provide: NotificationService, useValue: notify },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();
  });

  it('opens on the next version and says how many answers are ready and how many are not approved yet', () => {
    create();

    expect(el('ready')!.textContent).toContain('3 approved answers ready to publish');
    expect(el('ready')!.textContent).toContain('2 not approved yet');
    expect(el('publish')!.hasAttribute('disabled')).toBeFalse();
    expect(fixture.nativeElement.querySelectorAll('[data-version]').length).toBe(2);
  });

  it('shows what is held back and why, and says it is left out', () => {
    create(overview({ ready: 1, heldBack: [{ questionId: 'q', question: 'What does it cost?', code: 'ReviewDue', reason: 'Its approval lapsed.' }] }));

    const held = el('held-back')!;
    expect(held.textContent).toContain('1 approved answer needs another look and is left out');
    expect(held.textContent).toContain('What does it cost?');
    expect(held.textContent).toContain('Its approval lapsed.');
  });

  it('cannot publish when nothing is ready, nothing changed, or everything approved needs another look', () => {
    create(overview({ ready: 0, heldBack: [{ questionId: 'q', question: 'Q', code: 'NeedsRecheck', reason: 'r' }] }));
    expect(el('publish')!.hasAttribute('disabled')).toBeTrue();
    expect(el('cannot')!.textContent).toContain('needs another look first');

    fixture.destroy();
    create(overview({ ready: 0 }));
    expect(el('cannot')!.textContent).toContain('Approve some answers first');

    fixture.destroy();
    create(overview({ nothingNew: true }));
    expect(el('publish')!.hasAttribute('disabled')).toBeTrue();
    expect(el('cannot')!.textContent).toContain('Nothing has changed since version 2');
  });

  it('publishes with the note, reports the number, and opens the new version', () => {
    const c = create();
    service.publish.and.returnValue(of(version({ id: 'v3', number: 3 })));
    service.getVersion.and.returnValue(of(detail(version({ id: 'v3', number: 3 }))));
    c.note.setValue('  October prices  ');

    c.publish();

    expect(service.publish).toHaveBeenCalledWith('October prices');
    expect(notify.success).toHaveBeenCalledWith('Version 3 published.');
    expect(c.selectedId).toBe('v3');
    expect(c.note.value).toBe('');
    expect(service.get).toHaveBeenCalledTimes(2);
  });

  it('does not publish when it is not allowed', () => {
    const c = create(overview({ nothingNew: true }));

    c.publish();

    expect(service.publish).not.toHaveBeenCalled();
  });

  it('opens a version and shows exactly what it contained, with the evidence and when it must be confirmed again', () => {
    const c = create();

    c.select('v2');
    fixture.detectChanges();

    expect(service.getVersion).toHaveBeenCalledWith('v2');
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Version 2');
    expect(text).toContain('The fee is Rs 500.');
    expect(text).toContain('fee is Rs 500');
    expect(text).toContain('brochure.pdf · Page 2');
    expect(text).toContain('confirm again by');
    expect(el('version-note')!.textContent).toContain('New pricing');
    expect(el('restore')).toBeNull(); // the current version needs no restoring
  });

  it('restores an older version only after the tenant confirms, and publishes it as a new version', () => {
    const c = create();
    const old = version({ id: 'v1', number: 1, status: 'Superseded' });
    service.getVersion.and.returnValue(of(detail(old)));
    c.select('v1');
    fixture.detectChanges();
    dialog.open.and.returnValue({ afterClosed: () => of(false) } as never);

    el('restore')!.click();
    expect(service.restore).not.toHaveBeenCalled();

    dialog.open.and.returnValue({ afterClosed: () => of(true) } as never);
    service.restore.and.returnValue(of(version({ id: 'v3', number: 3, restoredFromNumber: 1 })));
    service.getVersion.and.returnValue(of(detail(version({ id: 'v3', number: 3 }))));
    el('restore')!.click();

    expect(service.restore).toHaveBeenCalledWith('v1', null);
    expect(notify.success).toHaveBeenCalledWith('Version 3 published from version 1.');
    expect(c.selectedId).toBe('v3');
  });

  it('saves the Draft file and the Final file of a version through the API', () => {
    const c = create();
    const saved: string[] = [];
    spyOn(c as never, 'save' as never).and.callFake(((_: Blob, name: string) => saved.push(name)) as never);
    service.draftFile.and.returnValue(of(new Blob(['draft'])));
    service.finalFile.and.returnValue(of(new Blob(['final'])));

    el('draft-file')!.click();
    c.select('v2');
    fixture.detectChanges();
    el('final-file')!.click();

    expect(saved).toEqual(['product-knowledge-draft.txt', 'product-knowledge-v2.txt']);
    expect(service.finalFile).toHaveBeenCalledWith('v2');
  });

  it('says nothing has been published yet before the first version', () => {
    create(overview({ ready: 1, current: null }, []));

    expect(el('no-versions')).not.toBeNull();
  });
});
