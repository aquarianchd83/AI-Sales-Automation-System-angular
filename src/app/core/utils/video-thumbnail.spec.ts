import { captureVideoThumbnail, thumbnailFor, uploadForm } from './video-thumbnail';

describe('video thumbnails', () => {
  it('an image needs no thumbnail and no waiting', () => {
    let result: Blob | null | undefined;
    thumbnailFor(new File([new Uint8Array([1])], 'logo.png', { type: 'image/png' })).subscribe((blob) => (result = blob));
    expect(result).toBeNull();
  });

  it('a file the browser cannot decode gives no thumbnail instead of failing the upload', async () => {
    const notAVideo = new File([new Uint8Array([1, 2, 3])], 'broken.mp4', { type: 'video/mp4' });
    expect(await captureVideoThumbnail(notAVideo)).toBeNull();
  });

  it('sends the thumbnail as its own part beside the file, only when there is one', () => {
    const file = new File([new Uint8Array([1])], 'promo.mp4', { type: 'video/mp4' });
    expect(uploadForm(file, null).has('thumbnail')).toBeFalse();

    const form = uploadForm(file, new Blob([new Uint8Array([9])], { type: 'image/jpeg' }));
    expect(form.get('file')).toBeTruthy();
    expect((form.get('thumbnail') as File).name).toBe('thumbnail.jpg');
  });
});
