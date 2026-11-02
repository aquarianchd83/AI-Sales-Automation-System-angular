import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { of, throwError } from 'rxjs';

import { KnowledgeSource, KnowledgeSourceDetail, KnowledgeSourcesOverview } from '../../../core/models/product-knowledge.model';
import { NotificationService } from '../../../core/services/notification.service';
import { ProductKnowledgeService } from '../../../core/services/product-knowledge.service';
import { SharedModule } from '../../../shared/shared.module';
import { KnowledgeSourcesComponent, POLL_MS } from './knowledge-sources.component';

const source = (over: Partial<KnowledgeSource> = {}): KnowledgeSource => ({
  id: 's1',
  kind: 'Document',
  name: 'brochure.pdf',
  url: null,
  fileName: 'brochure.pdf',
  sizeBytes: 2 * 1024 * 1024,
  status: 'Ready',
  errorCode: null,
  error: null,
  warnings: [],
  attempts: 1,
  version: 1,
  passageCount: 12,
  pageCount: 4,
  qualityScore: 0.95,
  usedAiReading: false,
  createdAt: '2026-10-19T09:00:00Z',
  processedAt: '2026-10-19T09:01:00Z',
  canRetry: false,
  canRescan: false,
  hasOriginal: true,
  hasText: true,
  ...over,
});

const overview = (sources: KnowledgeSource[], over: Partial<KnowledgeSourcesOverview> = {}): KnowledgeSourcesOverview => ({
  sources,
  maxSources: 50,
  maxFileMb: 10,
  supportedExtensions: ['.pdf', '.docx', '.txt', '.png'],
  scannedReading: 'Off',
  storageReady: true,
  documentUploadEnabled: true,
  websiteScanningEnabled: true,
  ...over,
});

const detail = (s: KnowledgeSource, over: Partial<KnowledgeSourceDetail> = {}): KnowledgeSourceDetail => ({
  source: s,
  pages: [],
  passages: [
    { id: 'p1', order: 0, pageNumber: 1, url: null, heading: 'Pricing', text: 'Consultation is Rs 500.', fromAiReading: false, extractedAt: '2026-10-19T09:01:00Z' },
    { id: 'p2', order: 1, pageNumber: 3, url: null, heading: null, text: 'Open Monday to Saturday.', fromAiReading: true, extractedAt: '2026-10-19T09:01:00Z' },
  ],
  passageTotal: 2,
  ...over,
});

describe('KnowledgeSourcesComponent', () => {
  let fixture: ComponentFixture<KnowledgeSourcesComponent>;
  let api: jasmine.SpyObj<ProductKnowledgeService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let dialog: { open: jasmine.Spy };

  const root = () => fixture.nativeElement as HTMLElement;
  const text = (sel: string) => (root().querySelector(sel)?.textContent ?? '').replace(/\s+/g, ' ').trim();

  function render(initial: KnowledgeSourcesOverview, details: Record<string, KnowledgeSourceDetail> = {}): KnowledgeSourcesComponent {
    api = jasmine.createSpyObj('ProductKnowledgeService', ['list', 'get', 'upload', 'addWebsite', 'retry', 'remove', 'download']);
    api.list.and.returnValue(of(initial));
    api.get.and.callFake((id: string) => of(details[id] ?? detail(initial.sources.find((s) => s.id === id) ?? source({ id }))));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    dialog = { open: jasmine.createSpy('open').and.returnValue({ afterClosed: () => of(true) }) };

    TestBed.configureTestingModule({
      declarations: [KnowledgeSourcesComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ProductKnowledgeService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: MatDialog, useValue: dialog },
      ],
    });
    fixture = TestBed.createComponent(KnowledgeSourcesComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  afterEach(() => fixture?.destroy());

  it('lists the sources on the left and opens the first on the right with its passages and where each came from', () => {
    render(overview([source(), source({ id: 's2', kind: 'Website', name: 'clinic.example', url: 'https://clinic.example/', fileName: null, sizeBytes: null })]));

    expect(root().querySelectorAll('[data-source]').length).toBe(2);
    expect(text('[data-source="s1"]')).toContain('12 passages · 4 pages');
    expect(root().querySelector('[data-detail="s1"]')).not.toBeNull();
    expect(text('[data-testid="status"]')).toBe('Read');

    const passages = Array.from(root().querySelectorAll('[data-testid="passages"] li')).map((li) => li.textContent?.replace(/\s+/g, ' ').trim());
    expect(passages[0]).toContain('Page 1');
    expect(passages[0]).toContain('Pricing');
    expect(passages[0]).toContain('Rs 500');
    expect(passages[1]).toContain('read by AI');
  });

  it('shows a website with every page and what happened to it', () => {
    const site = source({ id: 'w', kind: 'Website', name: 'clinic.example', url: 'https://clinic.example/', canRescan: true, hasOriginal: false });
    render(overview([site]), {
      w: detail(site, {
        pages: [
          { url: 'https://clinic.example/', title: 'Home', status: 'Read', httpStatus: 200, error: null, depth: 0, fetchedAt: '' },
          { url: 'https://clinic.example/index.html', title: null, status: 'Duplicate', httpStatus: 200, error: 'Same text as https://clinic.example/.', depth: 1, fetchedAt: '' },
          { url: 'https://clinic.example/gone', title: null, status: 'Failed', httpStatus: 404, error: 'The website answered 404.', depth: 1, fetchedAt: '' },
        ],
        passages: [{ id: 'p', order: 0, pageNumber: null, url: 'https://clinic.example/prices', heading: 'Prices', text: 'Rs 500.', fromAiReading: false, extractedAt: '' }],
      }),
    });

    expect(text('.sub-title')).toContain('1 read · 1 duplicate · 1 failed');
    expect(text('[data-page-status="Failed"]')).toContain('404');
    expect(text('[data-testid="passages"] .place')).toBe('/prices');
    expect(text('[data-testid="retry"]')).toContain('Scan again');
  });

  it('explains a failure in the tenants words and offers to try again', () => {
    const failed = source({ status: 'Failed', errorCode: 'ScannedReadingOff', error: 'This document is scanned and reading scanned pages is switched off.', canRetry: true, passageCount: 0 });
    const component = render(overview([failed]), { s1: detail(failed, { passages: [], passageTotal: 0 }) });
    api.retry.and.returnValue(of({ ...failed, status: 'Queued', error: null, canRetry: false }));

    expect(text('[data-testid="error"]')).toContain('switched off');
    (root().querySelector('[data-testid="retry"]') as HTMLButtonElement).click();

    expect(api.retry).toHaveBeenCalledWith('s1');
    expect(component.list[0].status).toBe('Queued');
  });

  it('keeps refreshing while a source is being read, and stops when nothing is', fakeAsync(() => {
    const reading = source({ status: 'Processing', passageCount: 0 });
    render(overview([reading]));
    api.list.calls.reset();
    api.list.and.returnValue(of(overview([source()])));

    tick(POLL_MS);
    expect(api.list).toHaveBeenCalledTimes(1);
    fixture.detectChanges();
    expect(text('[data-testid="status"]')).toBe('Read');

    tick(POLL_MS * 3);
    expect(api.list).toHaveBeenCalledTimes(1);
    discardPeriodicTasks();
  }));

  it('uploads each chosen file and refuses one over the size limit before sending it', () => {
    const component = render(overview([]));
    api.upload.and.callFake((file: File) => of(source({ id: file.name, name: file.name, status: 'Queued' })));

    const ok = new File(['%PDF-1.7'], 'price-list.pdf', { type: 'application/pdf' });
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'huge.pdf', { type: 'application/pdf' });
    component.onFiles([ok, big]);
    fixture.detectChanges();

    expect(api.upload).toHaveBeenCalledOnceWith(ok);
    expect(notify.error).toHaveBeenCalledWith('huge.pdf is larger than 10 MB.');
    expect(component.list.map((s) => s.name)).toEqual(['price-list.pdf']);
    expect(component.selectedId).toBe('price-list.pdf');
  });

  it('adds the website from the form', () => {
    const component = render(overview([]));
    api.addWebsite.and.returnValue(of(source({ id: 'w', kind: 'Website', name: 'clinic.example', status: 'Queued' })));

    component.website.setValue(' clinic.example ');
    component.addWebsite();

    expect(api.addWebsite).toHaveBeenCalledWith('clinic.example');
    expect(component.website.value).toBe('');
    expect(component.list[0].kind).toBe('Website');
  });

  it('cannot add sources when storage is not set up, and says why', () => {
    const component = render(overview([], { storageReady: false }));

    expect(root().querySelector('[data-testid="storage-off"]')).not.toBeNull();
    expect((root().querySelector('[data-testid="drop"] input') as HTMLInputElement).disabled).toBeTrue();
    component.onFiles([new File(['x'], 'a.pdf')]);
    expect(api.upload).not.toHaveBeenCalled();
  });

  it('cannot add sources once the limit is reached, and says why', () => {
    const full = render(overview([source()], { maxSources: 1 }));

    expect(full.atLimit).toBeTrue();
    expect(text('.limits')).toContain('Remove one to add another');
    expect((root().querySelector('[data-testid="add-website"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('removes a source after confirming and opens the next one', () => {
    const component = render(overview([source(), source({ id: 's2', name: 'faq.txt' })]));
    api.remove.and.returnValue(of(undefined));

    (root().querySelector('[data-testid="remove"]') as HTMLButtonElement).click();

    expect(dialog.open).toHaveBeenCalled();
    expect(api.remove).toHaveBeenCalledWith('s1');
    expect(component.list.map((s) => s.id)).toEqual(['s2']);
    expect(component.selectedId).toBe('s2');
  });

  it('with document upload switched off, uploads are blocked and a source cannot be read again, while websites still work', () => {
    const failed = source({ status: 'Failed', canRetry: true, error: 'x' });
    const component = render(overview([failed], { documentUploadEnabled: false }));

    expect(root().querySelector('[data-testid="documents-off"]')).not.toBeNull();
    expect(root().querySelector('[data-testid="websites-off"]')).toBeNull();
    expect((root().querySelector('[data-testid="drop"] input') as HTMLInputElement).disabled).toBeTrue();
    component.onFiles([new File(['x'], 'a.pdf')]);
    expect(api.upload).not.toHaveBeenCalled();
    expect(root().querySelector('[data-testid="retry"]')).toBeNull();
    expect(component.canAddWebsite).toBeTrue();
  });

  it('with website scanning switched off, no website can be added or scanned again, while documents still work', () => {
    const site = source({ id: 'w', kind: 'Website', name: 'clinic.example', canRescan: true });
    const component = render(overview([site], { websiteScanningEnabled: false }));

    expect(root().querySelector('[data-testid="websites-off"]')).not.toBeNull();
    expect((root().querySelector('[data-testid="add-website"]') as HTMLButtonElement).disabled).toBeTrue();
    expect(root().querySelector('[data-testid="retry"]')).toBeNull();
    component.website.setValue('other.example');
    component.addWebsite();
    expect(api.addWebsite).not.toHaveBeenCalled();
    expect(component.canUpload).toBeTrue();
  });

  it('says when scanned documents cannot be read on this platform', () => {
    render(overview([source()], { scannedReading: 'Off' }));

    expect(text('.limits')).toContain('Scanned PDFs and photos of documents cannot be read');
  });

  it('says so when the sources cannot be loaded', () => {
    api = jasmine.createSpyObj('ProductKnowledgeService', ['list']);
    api.list.and.returnValue(throwError(() => new Error('500')));
    TestBed.configureTestingModule({
      declarations: [KnowledgeSourcesComponent],
      imports: [SharedModule, NoopAnimationsModule, RouterTestingModule],
      providers: [
        { provide: ProductKnowledgeService, useValue: api },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']) },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(false) }) } },
      ],
    });
    fixture = TestBed.createComponent(KnowledgeSourcesComponent);
    fixture.detectChanges();

    expect(root().textContent).toContain('could not be loaded');
  });

  it('refuses to add a website address that fails validation', () => {
    const component = render(overview([]));

    component.website.setValue('x'.repeat(2001));
    component.addWebsite();

    expect(component.website.invalid).toBeTrue();
    expect(api.addWebsite).not.toHaveBeenCalled();
  });
});
