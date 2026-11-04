import { wsRoute, ApiError, isId } from '@/lib/api';
import { buildCsv, buildPdf, buildXlsx, loadReport } from '@/lib/reports';
import { rateLimit } from '@/lib/rateLimit';

const KINDS = ['daily', 'weekly', 'monthly', 'yearly', 'custom', 'budget', 'category', 'cashbook'];
const TYPES = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
};

export const GET = wsRoute('read', async ({ req, user, wid, workspace }) => {
  if (!rateLimit(`report:${user.id}`, 30, 60 * 60_000).ok) throw new ApiError(429, 'Too many reports. Try again later.');
  const sp = new URL(req.url).searchParams;
  const kind = sp.get('kind') || 'monthly';
  const format = sp.get('format') || 'pdf';
  if (!KINDS.includes(kind) || !Object.hasOwn(TYPES, format)) throw new ApiError(400, 'Unknown report type.');
  const budget = sp.get('budget');
  const category = sp.get('category');
  if ((kind === 'budget' && !isId(budget)) || (kind === 'category' && !isId(category))) throw new ApiError(400, 'Choose what to report on.');
  const report = await loadReport(wid, { kind, from: sp.get('from'), to: sp.get('to'), budget, category, tz: user.timezone, workspace, userName: user.name });
  if (!report) throw new ApiError(404, 'Not found.');
  const body = format === 'csv' ? buildCsv(report) : format === 'xlsx' ? await buildXlsx(report) : await buildPdf(report);
  return new Response(body, {
    headers: {
      'Content-Type': TYPES[format],
      'Content-Disposition': `attachment; filename="${report.fileStem}.${format}"`,
      'Cache-Control': 'no-store',
    },
  });
});
