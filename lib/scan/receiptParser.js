// Turns raw OCR text into a receipt. Pure and dependency-free so it can be unit tested.

const AMOUNT = /(?:rs\.?|pkr|usd|\$|€|£)?\s*(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(?:\/-|\/=|pkr|rs\.?)?\s*$/i;
const TOTAL = /\b(grand\s*total|net\s*total|net\s*payable|total\s*(amount|due|payable|bill)?|amount\s*(due|payable)|balance\s*due|bill\s*amount)\b/i;
const SUBTOTAL = /\bsub[\s-]*total\b/i;
const TAX = /\b(tax|gst|vat|fed|sales\s*tax|service\s*charge)\b/i;
const NOISE = /\b(cash|change|tender(ed)?|paid|card|visa|master\s*card|discount|thank|tel|phone|mobile|ntn|strn|invoice|receipt|cashier|counter|table|server|order\s*no|bill\s*no|www\.|qty|quantity|price|amount|item|description|rate)\b/i;

const toNumber = (s) => Number(String(s).replace(/,/g, ''));

export function parseDate(text) {
  const months = 'jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec';
  const named = text.match(new RegExp(`\\b(\\d{1,2})[\\s\\-/]*(${months})[a-z]*[\\s\\-/,]*(\\d{2,4})\\b`, 'i'));
  if (named) {
    const m = months.split('|').indexOf(named[2].toLowerCase().slice(0, 3));
    return build(named[3], m + 1, named[1]);
  }
  const iso = text.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return build(iso[1], iso[2], iso[3]);
  // Numeric dates are read day-first, which is the convention on Pakistani receipts.
  const dmy = text.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (dmy) return build(dmy[3], dmy[2], dmy[1]);
  return null;
}

function build(y, m, d) {
  const year = Number(y) < 100 ? 2000 + Number(y) : Number(y);
  const month = Number(m);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseItem(line) {
  const match = line.match(AMOUNT);
  if (!match) return null;
  const price = toNumber(match[1]);
  if (!(price > 0)) return null;
  let rest = line.slice(0, match.index).trim().replace(/[\s.:\-_|]+$/, '');
  let quantity = '1';
  let unitPrice = null;

  // "Milk 2 x 200" or "Milk 2 @ 200"
  const times = rest.match(/^(.*?)[\s(]+(\d+(?:\.\d+)?)\s*(?:x|\*|@)\s*(\d+(?:,\d{3})*(?:\.\d+)?)\)?$/i);
  if (times) {
    rest = times[1];
    quantity = times[2];
    unitPrice = toNumber(times[3]);
  } else {
    // "Rice 2 kg" or "Eggs 12", with the quantity after the name
    const trailing = rest.match(/^(.*?[a-z].*?)\s+(\d+(?:\.\d+)?)\s*(kg|g|gm|l|ltr|ml|pcs?|dozen|doz)?$/i);
    // "2 Milk" or "2 x Milk", with the quantity before the name
    const leading = rest.match(/^(\d+(?:\.\d+)?)\s*(kg|g|gm|l|ltr|ml|pcs?|x)?\s+(.+)$/i);
    if (trailing) {
      rest = trailing[1];
      quantity = `${trailing[2]}${trailing[3] ? ` ${trailing[3]}` : ''}`;
    } else if (leading) {
      rest = leading[3];
      quantity = `${leading[1]}${leading[2] && leading[2].toLowerCase() !== 'x' ? ` ${leading[2]}` : ''}`;
    }
  }
  const name = rest.replace(/^[^a-z0-9]+/i, '').replace(/\s{2,}/g, ' ').trim();
  if ((name.match(/[a-z]/gi) || []).length < 2) return null;
  return { name, quantity, unitPrice, price };
}

export function parseReceipt(raw) {
  const lines = String(raw || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const items = [];
  let total = null;
  let grand = false;
  let tax = 0;

  for (const line of lines) {
    const amount = line.match(AMOUNT);
    if (SUBTOTAL.test(line)) continue;
    if (TOTAL.test(line)) {
      if (amount) {
        const isGrand = /grand|net|payable|due/i.test(line);
        if (total === null || isGrand || !grand) {
          total = toNumber(amount[1]);
          grand = grand || isGrand;
        }
      }
      continue;
    }
    if (TAX.test(line)) {
      if (amount) tax += toNumber(amount[1]);
      continue;
    }
    if (NOISE.test(line)) continue;
    if (/\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(line) || /\d{1,2}:\d{2}/.test(line)) continue;
    const item = parseItem(line);
    if (item) items.push(item);
  }

  const store =
    lines.slice(0, 5).find((l) => (l.match(/[a-z]/gi) || []).length >= 3 && !AMOUNT.test(l) && !NOISE.test(l) && !parseDate(l)) || null;
  const itemsTotal = items.reduce((s, i) => s + i.price, 0);

  return {
    store,
    date: parseDate(lines.join('\n')),
    items,
    tax: tax || null,
    total: total ?? (items.length ? Math.round((itemsTotal + tax) * 100) / 100 : null),
  };
}
