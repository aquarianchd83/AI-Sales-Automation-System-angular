import { absoluteMediaUrl, mediaKindLabel, mediaPreviewUrl } from './media.model';

describe('media model helpers', () => {
  it('makes a relative url absolute against the given origin', () => {
    expect(absoluteMediaUrl('/media/a.png', 'https://x.test')).toBe('https://x.test/media/a.png');
  });

  it('keeps an absolute url as is', () => {
    expect(absoluteMediaUrl('https://cdn.example.com/a.png', 'https://x.test')).toBe('https://cdn.example.com/a.png');
  });

  it('labels the kind of file', () => {
    expect(mediaKindLabel('image/png')).toBe('Image');
    expect(mediaKindLabel('video/mp4')).toBe('Video');
    expect(mediaKindLabel('application/pdf')).toBe('File');
  });
});

describe('mediaPreviewUrl', () => {
  it('serves previews from the API origin, not the public tunnel', () => {
    expect(mediaPreviewUrl('https://x.ngrok-free.dev/media/a.png', 'https://api.test/api/v1', 'https://app.test')).toBe('https://api.test/media/a.png');
  });

  it('uses the page origin when the API base is relative (dev proxy)', () => {
    expect(mediaPreviewUrl('https://x.ngrok-free.dev/media/a.png', '/api/v1', 'http://localhost:4200')).toBe('http://localhost:4200/media/a.png');
  });
});
