/** MediaAssetDto. */
export interface MediaAsset {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
}

/**
 * Server defaults from MediaOptions ("Media" config section), mirroring WhatsApp's own limits.
 * Configurable server-side, so these are a fast-fail hint for the upload dialog — the server
 * re-checks size and content type regardless.
 */
export const MEDIA_MAX_SIZE_BYTES = 16 * 1024 * 1024;
export const MEDIA_ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/3gpp',
];

export function isImageContentType(contentType: string): boolean {
  return contentType.startsWith('image/');
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The link to share: the stored URL made absolute (a relative one is resolved against the page's own origin). */
export function absoluteMediaUrl(url: string, origin: string = window.location.origin): string {
  try {
    return new URL(url, origin).toString();
  } catch {
    return url;
  }
}

/**
 * True when Meta could fetch the link: stored as an absolute http(s) URL on a host that isn't
 * this machine. A relative URL means the API's MediaStorage PublicBaseUrl isn't set.
 */
export function isPublicMediaUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) {
    return false;
  }
  try {
    const host = new URL(url).hostname;
    return !(host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.localhost'));
  } catch {
    return false;
  }
}

export function mediaKindLabel(contentType: string): string {
  if (isImageContentType(contentType)) {
    return 'Image';
  }
  return contentType.startsWith('video/') ? 'Video' : 'File';
}
