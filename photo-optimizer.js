/** Browser-only image optimization. No raw files leave the browser before conversion. */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024;
export const MAX_OPTIMIZED_BYTES = 6 * 1024 * 1024;

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Unable to encode the image.')), type, quality);
  });
}
async function downscale(image, maxSide, type, quality) {
  const ratio = Math.min(1, maxSide / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * ratio));
  canvas.height = Math.max(1, Math.round(image.height * ratio));
  const ctx = canvas.getContext('2d', {alpha: false});
  if (!ctx) throw new Error('This browser cannot process photos.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#f2efe8';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const blob = await canvasBlob(canvas,type,quality);
  if (blob.type !== type) throw new Error('Your browser cannot export WebP. Please use an updated Chrome, Safari, or Edge.');
  return {blob, width:canvas.width,height:canvas.height};
}
export async function optimizePhoto(file) {
  if (!(file instanceof File)) throw new Error('Choose a photo file first.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('This file is over 30 MB. Export a smaller JPEG/PNG first.');
  const allowed = ['image/jpeg','image/png','image/webp','image/heic','image/heif'];
  if (!allowed.includes(file.type.toLowerCase())) throw new Error('Use a JPEG, PNG or WebP photo. HEIC may work on supported devices; otherwise export to JPEG first.');
  let bitmap;
  try { bitmap = await createImageBitmap(file, {imageOrientation:'from-image'}); }
  catch { throw new Error('This photo could not be decoded in this browser. Try exporting it as JPEG or PNG.'); }
  try {
    if (bitmap.width < 200 || bitmap.height < 200) throw new Error('Image is too small for a photography website.');
    let photo = await downscale(bitmap,2400,'image/webp',.82);
    if (photo.blob.size > MAX_OPTIMIZED_BYTES) photo = await downscale(bitmap,1900,'image/webp',.74);
    if (photo.blob.size > MAX_OPTIMIZED_BYTES) throw new Error('The optimized photo is too large for storage. Please export a smaller photo.');
    const medium = await downscale(bitmap,1200,'image/webp',.78);
    const thumb = await downscale(bitmap,560,'image/webp',.72);
    return {
      optimized:photo.blob,
      thumbnail:thumb.blob,
      medium:medium.blob,
      width:photo.width,
      medium_width:medium.width,
      thumb_width:thumb.width,
      height:photo.height,
      originalBytes:file.size,
      savedBytes:photo.blob.size,
      previewURL:URL.createObjectURL(photo.blob),
      thumbnailURL:URL.createObjectURL(thumb.blob)
    };
  } finally { bitmap.close(); }
}
export function prettyBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024**2) return `${(bytes/1024).toFixed(0)} KB`;
  return `${(bytes/1024**2).toFixed(2)} MB`;
}
