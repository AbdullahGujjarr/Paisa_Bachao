import fs from 'node:fs/promises';
import path from 'node:path';
import { route, ApiError } from '@/lib/api';
import { UPLOAD_DIR } from '@/lib/storage';
import { sniffMime } from '@/lib/sniff';

// Local-disk fallback for when Cloudinary is not configured. Names are 128-bit random values.
export const GET = route(async ({ params }) => {
  if (!/^[a-f0-9]{32}\.[a-z]+$/.test(params.name)) throw new ApiError(404, 'Not found.');
  const buffer = await fs.readFile(path.join(UPLOAD_DIR, params.name)).catch(() => null);
  if (!buffer) throw new ApiError(404, 'Not found.');
  return new Response(buffer, {
    headers: { 'Content-Type': sniffMime(buffer) || 'application/octet-stream', 'Cache-Control': 'private, max-age=86400' },
  });
});
