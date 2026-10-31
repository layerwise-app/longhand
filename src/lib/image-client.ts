// Browser side of image uploads: checks type and size, then scales large photos
// down and re-encodes them. Re-encoding also strips EXIF data, including the GPS
// position phones write into photos. The Worker stays free of image libraries.
import { imageLimitMessage, limits } from '~/lib/limits';

export type PreparedImage = {
  blob: Blob;
  width: number;
  height: number;
  name: string;
};

function assertAllowed(file: File) {
  if (
    !(limits.imageTypes as readonly string[]).includes(file.type) ||
    file.size > limits.imageMaxBytes
  ) {
    throw new Error(imageLimitMessage);
  }
}

export async function prepareImage(
  file: File,
  options: { maxSide?: number; quality?: number; jpegOnly?: boolean } = {}
): Promise<PreparedImage> {
  assertAllowed(file);
  const { maxSide = 1800, quality = 0.84, jpegOnly = false } = options;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That file doesn’t look like an image we can read.');
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  // Animated GIFs would lose their animation, so they pass through as they are.
  if (file.type === 'image/gif' && !jpegOnly) {
    bitmap.close();
    return { blob: file, width, height, name: file.name };
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d')!;
  // Covers become JPEGs, which every link preview can show.
  const type = jpegOnly || file.type === 'image/jpeg' ? 'image/jpeg' : 'image/webp';
  if (type === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, quality)
  );
  if (!blob) throw new Error('We couldn’t process that image.');
  return { blob, width, height, name: file.name };
}

export function toDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('We couldn’t read that image.'));
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(url: string) {
  const response = await fetch(url);
  return response.blob();
}
