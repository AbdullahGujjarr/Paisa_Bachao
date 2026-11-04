import { wsRoute, ApiError } from '@/lib/api';
import { rateLimit } from '@/lib/rateLimit';
import { sniffMime } from '@/lib/sniff';
import { storeFile } from '@/lib/storage';
import { analyzeDocument } from '@/lib/scan';
import { AI_DAILY_LIMIT, aiEnabled } from '@/lib/ai';
import { ReceiptScan } from '@/models';

const MAX = 15 * 1024 * 1024;

export const POST = wsRoute('add', async ({ req, user, wid }) => {
  if (!rateLimit(`scan:${user.id}`, 60, 60 * 60_000).ok) throw new ApiError(429, 'Too many scans. Try again later.');
  const form = await req.formData();
  const file = form.get('file');
  if (!file || typeof file === 'string') throw new ApiError(400, 'No file was sent.');
  if (file.size > MAX) throw new ApiError(413, 'Files can be up to 15 MB.');
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buffer);
  if (!mime) throw new ApiError(415, 'Use a photo (JPG, PNG, WebP, HEIC, GIF, BMP, TIFF, AVIF) or a PDF.');

  // A daily cap keeps AI costs predictable. Past it, scanning continues on free OCR.
  const useAI = aiEnabled && rateLimit(`scan-ai:${user.id}`, AI_DAILY_LIMIT, 24 * 3600_000).ok;
  let result;
  try {
    result = await analyzeDocument(buffer, mime, { useAI });
  } catch (err) {
    console.error('[scan]', err);
    throw new ApiError(422, 'This document could not be read. Try a clearer photo.');
  }
  const url = await storeFile(buffer, { mime, folder: 'paisabachao/receipts' });
  const scan = await ReceiptScan.create({
    workspace: wid,
    user: user._id,
    file: { url, name: String(file.name || 'receipt').slice(0, 200), mime },
    method: result.method,
    store: result.store || undefined,
    date: result.date || undefined,
    items: result.items,
    tax: result.tax ?? undefined,
    total: result.total ?? undefined,
    rawText: result.rawText?.slice(0, 20000),
  });
  return scan;
});
