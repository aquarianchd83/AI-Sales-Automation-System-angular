import { from, Observable, of } from 'rxjs';

const MAX_WIDTH = 640;
const TIMEOUT_MS = 10000;

/**
 * Cuts a still frame out of a video in the browser, so the API can store it next to the video and lists have a
 * picture to show. Resolves null - never rejects - when the browser cannot decode the file (3GP often cannot) or it
 * takes too long: the upload goes ahead without a thumbnail rather than failing.
 */
export function captureVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;

    const finish = (blob: Blob | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(blob);
    };
    const timer = setTimeout(() => finish(null), TIMEOUT_MS);

    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      // A little way in, so a fade-in from black is not the picture; a very short clip uses its middle.
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      video.currentTime = duration > 2 ? 1 : duration / 2;
    };
    video.onseeked = () => {
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        finish(null);
        return;
      }
      const scale = Math.min(1, MAX_WIDTH / width);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext('2d');
      if (!context) {
        finish(null);
        return;
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.8);
    };
    video.src = url;
  });
}

/** The thumbnail to send with a file: a frame for a video, nothing (and no waiting) for anything else. */
export function thumbnailFor(file: File): Observable<Blob | null> {
  return file.type.startsWith('video/') ? from(captureVideoThumbnail(file)) : of(null);
}

/** Adds the multipart parts of an upload: the file, and its thumbnail when there is one. */
export function uploadForm(file: File, thumbnail: Blob | null): FormData {
  const form = new FormData();
  form.append('file', file, file.name);
  if (thumbnail) {
    form.append('thumbnail', thumbnail, 'thumbnail.jpg');
  }
  return form;
}
