import { wsRoute, readJson, ApiError } from '@/lib/api';
import { scanSaveSchema } from '@/lib/schemas';
import { assertRefs } from '@/lib/crud';
import { checkBudgetAlerts } from '@/lib/alerts';
import { logAndBroadcast } from '@/lib/realtime';
import { money } from '@/lib/format';
import { round2 } from '@/lib/finance';
import { ReceiptScan, Transaction } from '@/models';

// Nothing a scan extracts reaches the Cash Book until the user reviews it and calls this route.
export const POST = wsRoute('add', async ({ req, user, wid, workspace }) => {
  const data = scanSaveSchema.parse(await readJson(req));
  await assertRefs(wid, data);
  const scan = await ReceiptScan.findOneAndUpdate(
    { _id: data.scanId, workspace: wid, savedAt: null },
    { savedAt: new Date() },
    { returnDocument: 'after' },
  );
  if (!scan) throw new ApiError(409, 'This scan has already been saved.');

  const base = {
    workspace: wid,
    type: 'expense',
    category: data.category || undefined,
    wallet: data.wallet || undefined,
    budget: data.budget || undefined,
    paymentMethod: data.paymentMethod,
    date: data.date,
    attachments: [scan.file],
    createdBy: user._id,
    paidBy: user._id,
    receiptScan: scan._id,
  };
  const label = data.store || 'Receipt';
  const itemsTotal = data.items.reduce((s, i) => s + i.price, 0);
  const total = round2(itemsTotal + data.tax);
  const docs =
    data.mode === 'single'
      ? [{ ...base, name: label, amount: total, description: data.items.map((i) => `${i.name} (${i.quantity || 1})`).join(', ').slice(0, 500) }]
      : [
          ...data.items.map((i) => ({ ...base, name: i.name, amount: i.price, description: `${label}, qty ${i.quantity || 1}` })),
          ...(data.tax > 0 ? [{ ...base, name: `Tax - ${label}`, amount: data.tax }] : []),
        ];
  await Transaction.insertMany(docs);
  await checkBudgetAlerts(wid, data.date);
  await logAndBroadcast({
    wid,
    user,
    action: 'added',
    entity: 'transaction',
    entityId: scan._id,
    summary: `${user.name} added a scanned receipt from ${label} (${money(total, workspace.currency)})`,
  });
  return { saved: docs.length, total };
});
