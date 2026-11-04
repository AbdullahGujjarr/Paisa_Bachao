const startsWith = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

/**
 * Identifies a file from its first bytes, never from its name or the browser's claim.
 * SVG is left out on purpose because it can carry scripts.
 */
export function sniffMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47])) return 'image/png';
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(buf, [0x42, 0x4d])) return 'image/bmp';
  if (startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a])) return 'image/tiff';
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf';
  if (startsWith(buf, [0x66, 0x74, 0x79, 0x70], 4)) {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (['avif', 'avis'].includes(brand)) return 'image/avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
}

export const EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'application/pdf': 'pdf',
};
