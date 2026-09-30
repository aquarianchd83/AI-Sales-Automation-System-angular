import { absoluteMediaUrl, isPublicMediaUrl, mediaKindLabel } from './media.model';

describe('media model helpers', () => {
  it('makes a relative url absolute against the given origin', () => {
    expect(absoluteMediaUrl('/media/a.png', 'https://x.test')).toBe('https://x.test/media/a.png');
  });

  it('keeps an absolute url as is', () => {
    expect(absoluteMediaUrl('https://cdn.example.com/a.png', 'https://x.test')).toBe('https://cdn.example.com/a.png');
  });

  it('treats only absolute non-local urls as public', () => {
    expect(isPublicMediaUrl('https://api.example.com/media/a.png')).toBeTrue();
    expect(isPublicMediaUrl('/media/a.png')).toBeFalse();
    expect(isPublicMediaUrl('http://localhost:5000/media/a.png')).toBeFalse();
    expect(isPublicMediaUrl('https://127.0.0.1/media/a.png')).toBeFalse();
  });

  it('labels the kind of file', () => {
    expect(mediaKindLabel('image/png')).toBe('Image');
    expect(mediaKindLabel('video/mp4')).toBe('Video');
    expect(mediaKindLabel('application/pdf')).toBe('File');
  });
});
