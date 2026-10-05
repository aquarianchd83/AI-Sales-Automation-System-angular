/** MediaAssetDto. */
export interface MediaAsset {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
  createdAt: string;
  /** True when the API's MediaStorage PublicBaseUrl makes the link reachable by Meta; false means it is not configured. */
  isPublicUrl: boolean;
  /** What the portal loads to show the file: a path on the API for stored files, the tenant's own link for linked ones. */
  previewUrl?: string | null;
  /** A still frame cut from a video when it was uploaded; null for images and for videos that have none. */
  thumbnailUrl?: string | null;
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

/** The picture to show for a video before it is played, or null when it has no thumbnail. */
export function mediaThumbnailUrl(asset: MediaAsset, apiBaseUrl: string): string | null {
  return asset.thumbnailUrl ? mediaPreviewUrl(asset.thumbnailUrl, apiBaseUrl) : null;
}

export function mediaKindLabel(contentType: string): string {
  if (isImageContentType(contentType)) {
    return 'Image';
  }
  return contentType.startsWith('video/') ? 'Video' : 'File';
}

/**
 * What an <img>/<video> in the portal loads. The API sends a path it serves itself for files it stores (so a tunnel or
 * CDN in front of the public link, e.g. ngrok's free warning page, cannot break previews) and the tenant's own link for
 * a file they host. A path gets the API's origin (or the dev proxy's); a full link is used as is.
 */
export function mediaPreviewUrl(previewUrl: string, apiBaseUrl: string, origin: string = window.location.origin): string {
  if (/^https?:\/\//i.test(previewUrl)) {
    return previewUrl;
  }
  try {
    return `${new URL(apiBaseUrl, origin).origin}${previewUrl}`;
  } catch {
    return previewUrl;
  }
}
