import mongoose from 'mongoose';
import { isId } from './api';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Builds a transaction query from URL params. Every value is cast, so none can inject operators. */
export function buildFilter(wid, sp) {
  const filter = { workspace: new mongoose.Types.ObjectId(wid) };
  const q = sp.get('q')?.trim().slice(0, 80);
  if (q) {
    const re = new RegExp(escapeRe(q), 'i');
    filter.$or = [{ name: re }, { description: re }, { notes: re }, { tags: re }];
  }
  const type = sp.get('type');
  if (type === 'income' || type === 'expense') filter.type = type;
  for (const key of ['category', 'wallet', 'budget', 'createdBy']) {
    const v = sp.get(key);
    if (isId(v)) filter[key] = new mongoose.Types.ObjectId(v);
  }
  const tag = sp.get('tag');
  if (tag) filter.tags = tag.slice(0, 30);
  const from = sp.get('from');
  const to = sp.get('to');
  if ((from && !Number.isNaN(Date.parse(from))) || (to && !Number.isNaN(Date.parse(to)))) {
    filter.date = {};
    if (from && !Number.isNaN(Date.parse(from))) filter.date.$gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) filter.date.$lte = new Date(to);
  }
  const min = Number(sp.get('min'));
  const max = Number(sp.get('max'));
  if (min > 0 || max > 0) {
    filter.amount = {};
    if (min > 0) filter.amount.$gte = min;
    if (max > 0) filter.amount.$lte = max;
  }
  return filter;
}
