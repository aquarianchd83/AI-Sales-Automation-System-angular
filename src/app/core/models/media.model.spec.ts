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
  it('serves a stored file from the API origin', () => {
    expect(mediaPreviewUrl('/media/2026/10/a.png', 'https://api.test/api/v1', 'https://app.test')).toBe('https://api.test/media/2026/10/a.png');
  });

  it('uses the page origin when the API base is relative (dev proxy)', () => {
    expect(mediaPreviewUrl('/media/a.png', '/api/v1', 'http://localhost:4200')).toBe('http://localhost:4200/media/a.png');
  });

  it("leaves a tenant's own link alone", () => {
    expect(mediaPreviewUrl('https://bucket.s3.amazonaws.com/logo.png', '/api/v1', 'http://localhost:4200')).toBe('https://bucket.s3.amazonaws.com/logo.png');
  });
});
