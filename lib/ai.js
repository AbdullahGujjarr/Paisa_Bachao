import { GoogleGenAI } from '@google/genai';

export const aiEnabled = Boolean(process.env.GEMINI_API_KEY);
export const AI_MODEL = process.env.AI_MODEL || 'gemini-3.5-flash';
export const AI_FALLBACK_MODEL = process.env.AI_FALLBACK_MODEL || 'gemini-flash-lite-latest';
export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 30);

let client;
function gemini() {
  // Without a timeout, a busy model can leave the user waiting indefinitely.
  client ||= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 25_000 } });
  return client;
}

/** Calls Gemini, moving to the backup model if the main one is busy, slow or retired. */
export async function generate(params) {
  try {
    return await gemini().models.generateContent({ ...params, model: AI_MODEL });
  } catch (err) {
    // A 400-range error means the request itself is wrong, so a second model would not help.
    if (err?.status >= 400 && err.status < 500 && ![404, 429].includes(err.status)) throw err;
    console.error(`[ai] ${AI_MODEL} failed (${err?.status || err?.name}), trying ${AI_FALLBACK_MODEL}`);
    return gemini().models.generateContent({ ...params, model: AI_FALLBACK_MODEL });
  }
}
