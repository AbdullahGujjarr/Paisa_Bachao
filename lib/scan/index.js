import path from 'node:path';
import sharp from 'sharp';
import { z } from 'zod';
import { aiEnabled, generate } from '../ai';
import { parseReceipt } from './receiptParser';

const ReceiptSchema = z.object({
  store: z.string().nullable(),
  date: z.string().nullable().describe('Receipt date as YYYY-MM-DD, or null if not shown'),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.string().describe('Quantity with its unit if shown, for example "2 kg". Use "1" if not shown'),
      unitPrice: z.number().nullable(),
      price: z.number().describe('Line total for this item'),
    }),
  ),
  tax: z.number().nullable(),
  total: z.number().nullable().describe('The grand total printed on the document'),
  readable: z.boolean().describe('False if this is not a receipt, bill, invoice or expense list, or cannot be read'),
});

const PROMPT = `Extract this receipt, bill, invoice or handwritten expense list into the requested structure.
Copy item names as written and transcribe amounts exactly. Leave a field null rather than guessing it.
Do not list tax, subtotal, total, cash tendered or change as items.`;

async function toHeicFree(buffer, mime) {
  if (mime !== 'image/heic') return buffer;
  const { default: convert } = await import('heic-convert');
  return Buffer.from(await convert({ buffer, format: 'JPEG', quality: 0.9 }));
}

async function extractWithAI(buffer, mime) {
  let inlineData;
  if (mime === 'application/pdf') {
    inlineData = { mimeType: 'application/pdf', data: buffer.toString('base64') };
  } else {
    // A smaller image keeps each scan fast and cheap, and also covers every format sharp reads.
    const jpeg = await sharp(await toHeicFree(buffer, mime))
      .rotate()
      .resize({ width: 1568, height: 1568, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#fff' })
      .jpeg({ quality: 85 })
      .toBuffer();
    inlineData = { mimeType: 'image/jpeg', data: jpeg.toString('base64') };
  }
  const res = await generate({
    contents: [{ role: 'user', parts: [{ inlineData }, { text: PROMPT }] }],
    config: { responseMimeType: 'application/json', responseJsonSchema: z.toJSONSchema(ReceiptSchema) },
  });
  if (!res.text) throw new Error(`AI extraction returned nothing: ${res.candidates?.[0]?.finishReason || res.promptFeedback?.blockReason}`);
  const out = ReceiptSchema.parse(JSON.parse(res.text));
  const parsedDate = out.date ? new Date(`${out.date}T12:00:00Z`) : null;
  return { ...out, date: parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null, method: 'ai', rawText: '' };
}

async function ocrImages(images) {
  const { createWorker } = await import('tesseract.js');
  // The language data ships in node_modules, so OCR needs no network and no paid service.
  const worker = await createWorker('eng', 1, {
    langPath: path.join(process.cwd(), 'node_modules/@tesseract.js-data/eng/4.0.0'),
    cacheMethod: 'none',
    gzip: true,
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '6' });
    const pages = [];
    for (const image of images) {
      const { data } = await worker.recognize(image);
      pages.push(data.text);
    }
    return pages.join('\n');
  } finally {
    await worker.terminate();
  }
}

async function prepareForOcr(buffer) {
  const meta = await sharp(buffer).metadata();
  const width = meta.width && meta.width < 1400 ? 1800 : undefined;
  return sharp(buffer).rotate().resize({ width, withoutEnlargement: false }).flatten({ background: '#fff' }).grayscale().normalize().png().toBuffer();
}

async function extractWithOcr(buffer, mime) {
  if (mime === 'application/pdf') {
    const { getDocumentProxy, extractText, renderPageAsImage } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: true });
    if (text.replace(/\s/g, '').length > 20) {
      return { ...parseReceipt(text), method: 'pdf-text', rawText: text };
    }
    // No text layer, which means a scanned PDF. Render the pages and OCR them.
    const pages = [];
    for (let p = 1; p <= Math.min(pdf.numPages, 3); p += 1) {
      const png = await renderPageAsImage(pdf, p, { canvasImport: () => import('@napi-rs/canvas'), scale: 2 });
      pages.push(await prepareForOcr(Buffer.from(png)));
    }
    const scanned = await ocrImages(pages);
    return { ...parseReceipt(scanned), method: 'ocr', rawText: scanned };
  }
  const image = await prepareForOcr(await toHeicFree(buffer, mime));
  const text = await ocrImages([image]);
  return { ...parseReceipt(text), method: 'ocr', rawText: text };
}

/** Uses AI vision when a key is set. Free OCR handles every other case, including AI failures. */
export async function analyzeDocument(buffer, mime, { useAI = aiEnabled } = {}) {
  if (useAI) {
    try {
      const result = await extractWithAI(buffer, mime);
      if (result.readable !== false && result.items.length) return result;
    } catch (err) {
      console.error('[scan] AI extraction failed, using OCR:', err?.message);
    }
  }
  return extractWithOcr(buffer, mime);
}
