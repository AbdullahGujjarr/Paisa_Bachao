import { DateTime } from 'luxon';

export const CURRENCIES = ['PKR', 'USD', 'EUR', 'GBP', 'AED', 'SAR', 'INR', 'CAD', 'AUD'];

export function money(amount, currency = 'PKR') {
  const n = Number(amount) || 0;
  const digits = Number.isInteger(n) ? 0 : 2;
  if (currency === 'PKR') {
    const sign = n < 0 ? '-' : '';
    return `${sign}Rs. ${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(n);
}

/** Compact axis label, e.g. 12.5k. */
export function compact(n, digits = 1) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: digits }).format(Number(n) || 0);
}

export function formatDate(d, fmt = 'dd MMM yyyy', zone) {
  const dt = DateTime.fromJSDate(new Date(d));
  return (zone ? dt.setZone(zone) : dt).toFormat(fmt);
}

export function daysUntil(d) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

/** Value for an <input type="datetime-local">. */
export function toLocalInput(d = new Date()) {
  return DateTime.fromJSDate(new Date(d)).toFormat("yyyy-MM-dd'T'HH:mm");
}

export function toDateInput(d = new Date()) {
  return DateTime.fromJSDate(new Date(d)).toFormat('yyyy-MM-dd');
}
