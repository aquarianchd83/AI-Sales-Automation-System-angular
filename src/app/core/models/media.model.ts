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

export function mediaKindLabel(contentType: string): string {
  if (isImageContentType(contentType)) {
    return 'Image';
  }
  return contentType.startsWith('video/') ? 'Video' : 'File';
}

/**
 * Where the portal itself loads a file from for previews: the API's own address (or the dev proxy) rather than the
 * public link. A tunnel such as ngrok's free plan answers browsers with an interstitial page instead of the file, which
 * would leave every thumbnail broken; Meta's servers are not affected, so the public link stays what we show to copy.
 */
export function mediaPreviewUrl(url: string, apiBaseUrl: string, origin: string = window.location.origin): string {
  try {
    const path = new URL(url, origin);
    const apiOrigin = new URL(apiBaseUrl, origin).origin;
    return `${apiOrigin}${path.pathname}${path.search}`;
  } catch {
    return url;
  }
}
