import path from 'node:path';
import { DateTime } from 'luxon';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { Budget, Category, Transaction } from '@/models';
import { budgetSpent, byCategory, rangeFor, totals } from './analytics';
import { round2 } from './finance';

const MAP = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year', custom: 'custom' };

/** Loads one report's data. Kinds: daily, weekly, monthly, yearly, custom, budget, category, cashbook. */
export async function loadReport(wid, { kind, from, to, budget, category, tz, workspace, userName }) {
  let start;
  let end;
  let title = 'Expense report';
  const filter = { workspace: wid };
  if (kind === 'budget') {
    const b = await Budget.findOne({ _id: budget, workspace: wid }).lean();
    if (!b) return null;
    start = DateTime.fromJSDate(b.startDate).setZone(tz);
    end = DateTime.fromJSDate(b.endDate).setZone(tz);
    title = `Budget report: ${b.name}`;
    filter.type = 'expense';
    filter.$or = [{ budget: b._id }, { budget: null, ...(b.categories.length ? { category: { $in: b.categories } } : {}) }];
    filter.budgetInfo = { amount: b.amount, spent: await budgetSpent(b) };
  } else if (kind === 'cashbook') {
    const first = await Transaction.findOne({ workspace: wid }).sort({ date: 1 }).select('date').lean();
    start = DateTime.fromJSDate(first?.date || new Date()).setZone(tz).startOf('day');
    end = DateTime.now().setZone(tz).endOf('day');
    title = 'Complete Cash Book';
  } else if (kind === 'category') {
    const c = await Category.findOne({ _id: category, workspace: wid }).lean();
    if (!c) return null;
    ({ from: start, to: end } = rangeFor(from && to ? 'custom' : 'year', tz, from, to));
    title = `Category report: ${c.name}`;
    filter.category = c._id;
  } else {
    ({ from: start, to: end } = rangeFor(MAP[kind] || 'month', tz, from, to));
    title = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly', custom: 'Custom' }[kind] + ' report';
  }

  const { budgetInfo, ...query } = filter;
  const rows = await Transaction.find({ ...query, date: { $gte: start.toJSDate(), $lte: end.toJSDate() } })
    .sort({ date: 1 })
    .limit(10000)
    .populate('category', 'name')
    .populate('wallet', 'name')
    .populate('createdBy', 'name')
    .lean();

  const narrowed = kind === 'budget' || kind === 'category';
  const sum = (t) => round2(rows.filter((r) => r.type === t).reduce((s, r) => s + r.amount, 0));
  const t = narrowed ? { income: sum('income'), expense: sum('expense') } : await totals(wid, start, end);
  let categories = await byCategory(wid, start, end);
  if (narrowed) {
    const map = new Map();
    for (const r of rows.filter((x) => x.type === 'expense')) {
      const name = r.category?.name || 'Uncategorised';
      map.set(name, round2((map.get(name) || 0) + r.amount));
    }
    categories = [...map].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }
  return {
    title,
    kind,
    workspaceName: workspace.name,
    userName,
    currency: workspace.currency,
    period: `${start.toFormat('dd MMM yyyy')} to ${end.toFormat('dd MMM yyyy')}`,
    fileStem: `PaisaBachao-${kind}-${start.toFormat('yyyyMMdd')}-${end.toFormat('yyyyMMdd')}`,
    income: t.income,
    expense: t.expense,
    balance: round2(t.income - t.expense),
    categories,
    budgetInfo,
    rows: rows.map((r) => ({
      date: DateTime.fromJSDate(r.date).setZone(tz).toFormat('dd MMM yyyy'),
      name: r.name,
      type: r.type,
      category: r.category?.name || '',
      wallet: r.wallet?.name || '',
      method: r.paymentMethod || '',
      by: r.createdBy?.name || '',
      amount: r.amount,
      notes: r.notes || r.description || '',
    })),
  };
}

// A leading = + - or @ would make a spreadsheet run the cell as a formula.
const safeCell = (v) => {
  const s = String(v ?? '');
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

export function buildCsv(r) {
  const head = ['Date', 'Name', 'Type', 'Category', 'Wallet', 'Payment method', 'Added by', `Amount (${r.currency})`, 'Notes'];
  const lines = [
    head.join(','),
    ...r.rows.map((x) => [x.date, x.name, x.type, x.category, x.wallet, x.method, x.by, x.amount, x.notes].map(safeCell).join(',')),
  ];
  return `﻿${lines.join('\r\n')}\r\n`;
}

export async function buildXlsx(r) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PaisaBachao';
  const green = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B5D3F' } };
  const numFmt = '#,##0.00';

  const s = wb.addWorksheet('Summary');
  s.columns = [{ width: 30 }, { width: 18 }, { width: 12 }];
  s.addRow(['PaisaBachao']).font = { bold: true, size: 16, color: { argb: 'FF0B5D3F' } };
  s.addRow([r.title]).font = { bold: true };
  s.addRow([`${r.workspaceName} - ${r.userName}`]);
  s.addRow([r.period]);
  s.addRow([]);
  [['Income', r.income], ['Expenses', r.expense], ['Balance', r.balance]].forEach(([k, v]) => {
    const row = s.addRow([k, v]);
    row.getCell(2).numFmt = numFmt;
    row.font = { bold: k === 'Balance' };
  });
  s.addRow([]);
  const head = s.addRow(['Category', `Spent (${r.currency})`, 'Share']);
  head.eachCell((c) => {
    c.fill = green;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
  const first = head.number + 1;
  const total = r.categories.reduce((a, c) => a + c.total, 0) || 1;
  r.categories.forEach((c) => {
    const row = s.addRow([c.name, c.total, c.total / total]);
    row.getCell(2).numFmt = numFmt;
    row.getCell(3).numFmt = '0%';
  });
  if (r.categories.length) {
    // Data bars draw the category chart inside the sheet.
    s.addConditionalFormatting({
      ref: `B${first}:B${first + r.categories.length - 1}`,
      rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF0F7A55' }, gradient: false }],
    });
  }

  const t = wb.addWorksheet('Transactions', { views: [{ state: 'frozen', ySplit: 1 }] });
  t.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Name', key: 'name', width: 32 },
    { header: 'Type', key: 'type', width: 10 },
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Wallet', key: 'wallet', width: 14 },
    { header: 'Method', key: 'method', width: 12 },
    { header: 'Added by', key: 'by', width: 18 },
    { header: `Amount (${r.currency})`, key: 'amount', width: 16, style: { numFmt } },
    { header: 'Notes', key: 'notes', width: 36 },
  ];
  t.getRow(1).eachCell((c) => {
    c.fill = green;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
  r.rows.forEach((x) => t.addRow(x));
  t.autoFilter = { from: 'A1', to: 'I1' };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// The built-in PDF fonts only cover Latin text, so anything else prints as a placeholder.
const latin = (s) => String(s ?? '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
const amountText = (n, currency) => `${currency} ${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export function buildPdf(r) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true, info: { Title: `PaisaBachao - ${r.title}`, Author: 'PaisaBachao' } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const GREEN = '#0b5d3f';
    const INK = '#1f2933';
    const MUTED = '#6b7280';
    const left = 40;
    const width = doc.page.width - 80;

    doc.image(path.join(process.cwd(), 'public/icons/icon-192.png'), left, 36, { width: 44 });
    doc.fillColor(GREEN).font('Helvetica-Bold').fontSize(20).text('PaisaBachao', left + 54, 38);
    doc.fillColor(MUTED).font('Helvetica').fontSize(9).text('Your Money. Your Control. Your Savings.', left + 54, 62);
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(14).text(latin(r.title), left, 96);
    doc.fillColor(MUTED).font('Helvetica').fontSize(10).text(`${latin(r.workspaceName)} - ${latin(r.userName)}`, left, 114).text(r.period, left, 128);

    const cards = [['Income', r.income, GREEN], ['Expenses', r.expense, '#b4372e'], ['Balance', r.balance, INK]];
    const cw = (width - 20) / 3;
    cards.forEach(([label, value, color], i) => {
      const x = left + i * (cw + 10);
      doc.roundedRect(x, 150, cw, 54, 6).fillAndStroke('#f3f6f4', '#dfe7e2');
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(label, x + 10, 160);
      doc.fillColor(color).font('Helvetica-Bold').fontSize(13).text(amountText(value, r.currency), x + 10, 176, { width: cw - 20 });
    });

    let y = 222;
    if (r.budgetInfo) {
      doc.fillColor(INK).font('Helvetica').fontSize(10).text(`Budget ${amountText(r.budgetInfo.amount, r.currency)}, spent ${amountText(r.budgetInfo.spent, r.currency)}`, left, y);
      y += 20;
    }
    if (r.categories.length) {
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text('Spending by category', left, y);
      y += 20;
      const max = r.categories[0].total || 1;
      for (const c of r.categories.slice(0, 8)) {
        doc.fillColor(INK).font('Helvetica').fontSize(9).text(latin(c.name), left, y + 2, { width: 120, lineBreak: false, ellipsis: true });
        const barW = Math.max(2, ((width - 240) * c.total) / max);
        doc.roundedRect(left + 125, y, barW, 12, 2).fill('#0f7a55');
        doc.fillColor(MUTED).fontSize(9).text(amountText(c.total, r.currency), left + 130 + barW, y + 2);
        y += 19;
      }
      y += 12;
    }

    const cols = [
      ['Date', 68, 'date'],
      ['Name', 170, 'name'],
      ['Category', 110, 'category'],
      ['Type', 55, 'type'],
      ['Amount', width - 403, 'amount'],
    ];
    const header = () => {
      doc.rect(left, y, width, 18).fill(GREEN);
      let x = left + 6;
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(9);
      cols.forEach(([label, w]) => {
        doc.text(label, x, y + 5, { width: w - 8, lineBreak: false, align: label === 'Amount' ? 'right' : 'left' });
        x += w;
      });
      y += 20;
    };
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(12).text(`Transactions (${r.rows.length})`, left, y);
    y += 18;
    header();
    doc.font('Helvetica').fontSize(9);
    r.rows.forEach((row, i) => {
      if (y > doc.page.height - 60) {
        doc.addPage();
        y = 40;
        header();
        doc.font('Helvetica').fontSize(9);
      }
      if (i % 2) doc.rect(left, y - 2, width, 16).fill('#f6f8f7');
      let x = left + 6;
      cols.forEach(([, w, key]) => {
        const value = key === 'amount' ? amountText(row.amount, r.currency) : latin(row[key]);
        doc.fillColor(key === 'amount' && row.type === 'income' ? GREEN : INK).text(value, x, y + 2, { width: w - 8, lineBreak: false, ellipsis: true, align: key === 'amount' ? 'right' : 'left' });
        x += w;
      });
      y += 16;
    });
    if (!r.rows.length) doc.fillColor(MUTED).text('No transactions in this period.', left, y + 4);

    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i += 1) {
      doc.switchToPage(i);
      const bottom = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fillColor(MUTED).fontSize(8).text(`PaisaBachao - page ${i + 1} of ${range.count}`, left, doc.page.height - 28, { width, align: 'center', lineBreak: false });
      doc.page.margins.bottom = bottom;
    }
    doc.end();
  });
}
