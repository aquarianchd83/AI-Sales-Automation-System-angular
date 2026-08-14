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
