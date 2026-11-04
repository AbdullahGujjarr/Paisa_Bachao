import { route, ApiError } from '@/lib/api';
import { rateLimit } from '@/lib/rateLimit';
import { sniffMime } from '@/lib/sniff';
import { storeFile } from '@/lib/storage';

const MAX = 10 * 1024 * 1024;

export const POST = route(async ({ req, user }) => {
  if (!rateLimit(`upload:${user.id}`, 40, 60 * 60_000).ok) throw new ApiError(429, 'Too many uploads. Try again later.');
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new ApiError(400, 'No file was sent.');
  if (file.size > MAX) throw new ApiError(413, 'Files can be up to 10 MB.');
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buffer);
  if (!mime) throw new ApiError(415, 'That file type is not supported.');
  const url = await storeFile(buffer, { mime, folder: 'paisabachao/uploads' });
  return { url, name: String(file.name || 'file').slice(0, 200), mime };
});
