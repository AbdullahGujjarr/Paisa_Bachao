import { wsRoute, readJson, assertId, ApiError } from '@/lib/api';
import { paymentSchema } from '@/lib/schemas';
import { logAndBroadcast } from '@/lib/realtime';
import { money } from '@/lib/format';
import { round2 } from '@/lib/finance';
import { Debt } from '@/models';

export const POST = wsRoute('edit', async ({ req, user, params, wid, workspace }) => {
  const payment = paymentSchema.parse(await readJson(req));
  const debt = await Debt.findOne({ _id: assertId(params.id), workspace: wid });
  if (!debt) throw new ApiError(404, 'Debt not found.');
  const left = round2(debt.amount - debt.paid);
  if (payment.amount > left) throw new ApiError(422, `Only ${money(left, workspace.currency)} is left on this debt.`);
  debt.payments.push(payment);
  debt.paid = round2(debt.paid + payment.amount);
  await debt.save();
  await logAndBroadcast({ wid, user, action: 'edited', entity: 'debt', entityId: debt._id, summary: `${user.name} recorded ${money(payment.amount, workspace.currency)} repayment with ${debt.person}` });
  return debt;
});
