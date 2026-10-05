import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';

import { MediaAsset } from '../../../core/models/media.model';
import { NotificationService } from '../../../core/services/notification.service';
import { PlatformMediaService } from '../../../core/services/platform-media.service';
import { SharedModule } from '../../../shared/shared.module';
import { PlatformMediaComponent } from './platform-media.component';

const asset = (over: Partial<MediaAsset> = {}): MediaAsset => ({
  id: 'm1',
  fileName: 'hero.png',
  contentType: 'image/png',
  sizeBytes: 120_000,
  url: 'https://cdn.example.com/hero.png',
  createdAt: '2026-10-01T10:00:00Z',
  isPublicUrl: true,
  previewUrl: 'https://cdn.example.com/hero.png',
  ...over,
});

describe('PlatformMediaComponent', () => {
  let media: jasmine.SpyObj<PlatformMediaService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let dialog: jasmine.SpyObj<MatDialog>;

  const create = (items: MediaAsset[]) => {
    media = jasmine.createSpyObj('PlatformMediaService', ['getAll', 'upload', 'replace', 'delete']);
    media.getAll.and.returnValue(of(items));
    notify = jasmine.createSpyObj('NotificationService', ['success', 'error', 'info']);
    dialog = jasmine.createSpyObj('MatDialog', ['open']);

    TestBed.configureTestingModule({
      declarations: [PlatformMediaComponent],
      imports: [SharedModule, NoopAnimationsModule],
      providers: [
        { provide: PlatformMediaService, useValue: media },
        { provide: NotificationService, useValue: notify },
        { provide: MatDialog, useValue: dialog },
      ],
    });

    const fixture = TestBed.createComponent(PlatformMediaComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, text: () => (fixture.nativeElement as HTMLElement).textContent ?? '' };
  };

  const pick = (component: PlatformMediaComponent, file: File): void => {
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [file] });
    component.onFileChosen({ target: input } as unknown as Event);
  };

  it('lists the files and says which cannot go in a template', () => {
    const { text } = create([
      asset(),
      asset({ id: 'm2', fileName: 'clip.mp4', contentType: 'video/mp4' }),
      asset({ id: 'm3', fileName: 'still.webp', contentType: 'image/webp' }),
    ]);

    expect(text()).toContain('hero.png');
    expect(text()).toContain('3 files');
    expect(text().match(/Not usable in a template/g)?.length).toBe(1);
  });

  it('warns when the files have no public link, because Meta cannot fetch them', () => {
    expect(create([asset({ isPublicUrl: false })]).text()).toContain('Public links are not set up');
  });

  it('shows an empty state', () => {
    expect(create([]).text()).toContain('No media yet');
  });

  it('uploads a chosen file and reloads', () => {
    const { component } = create([]);
    media.upload.and.returnValue(of(asset()));

    pick(component, new File([new Uint8Array(10)], 'hero.png', { type: 'image/png' }));

    expect(media.upload).toHaveBeenCalled();
    expect(notify.success).toHaveBeenCalled();
    expect(media.getAll).toHaveBeenCalledTimes(2);
  });

  it('replaces the file behind an entry instead of adding one', () => {
    const { component } = create([asset()]);
    media.replace.and.returnValue(of(asset()));

    component.chooseToReplace(asset(), { click: () => undefined } as HTMLInputElement);
    pick(component, new File([new Uint8Array(10)], 'new.png', { type: 'image/png' }));

    expect(media.replace).toHaveBeenCalledWith('m1', jasmine.any(File));
    expect(media.upload).not.toHaveBeenCalled();
  });

  it('refuses an empty file or a type Meta would not take, without calling the server', () => {
    const { component } = create([]);

    pick(component, new File([], 'empty.png', { type: 'image/png' }));
    pick(component, new File([new Uint8Array(10)], 'notes.pdf', { type: 'application/pdf' }));

    expect(media.upload).not.toHaveBeenCalled();
    expect(notify.error).toHaveBeenCalledTimes(2);
  });

  it('deletes only after confirmation', () => {
    const { component } = create([asset()]);
    media.delete.and.returnValue(of(undefined));

    dialog.open.and.returnValue({ afterClosed: () => of(false) } as never);
    component.delete(asset());
    expect(media.delete).not.toHaveBeenCalled();

    dialog.open.and.returnValue({ afterClosed: () => of(true) } as never);
    component.delete(asset());
    expect(media.delete).toHaveBeenCalledWith('m1');
  });
});
