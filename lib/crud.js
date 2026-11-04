import { Category, Wallet, Budget, SavingsGoal, RecurringTransaction, Debt, Subscription, Transaction, WorkspaceMember } from '@/models';
import { budgetSchema, categorySchema, debtSchema, goalSchema, recurringSchema, subscriptionSchema, walletSchema } from './schemas';
import { budgetsWithStatus, walletBalances } from './analytics';
import { ApiError } from './api';

/** Rejects references to records in another workspace, which validation alone cannot catch. */
export async function assertRefs(wid, { category, wallet, budget, categories, paidBy }) {
  const checks = [];
  const owned = (Model, id, label) =>
    checks.push(
      Model.exists({ _id: id, workspace: wid }).then((ok) => {
        if (!ok) throw new ApiError(422, `That ${label} is not in this workspace.`);
      }),
    );
  if (category) owned(Category, category, 'category');
  if (wallet) owned(Wallet, wallet, 'wallet');
  if (budget) owned(Budget, budget, 'budget');
  for (const id of categories || []) owned(Category, id, 'category');
  if (paidBy) {
    checks.push(
      WorkspaceMember.exists({ workspace: wid, user: paidBy }).then((ok) => {
        if (!ok) throw new ApiError(422, 'That person is not a member of this workspace.');
      }),
    );
  }
  await Promise.all(checks);
}

export const resources = {
  categories: { model: Category, schema: categorySchema, label: 'category', sort: { kind: 1, name: 1 }, unset: 'category' },
  wallets: { model: Wallet, schema: walletSchema, label: 'wallet', sort: { createdAt: 1 }, unset: 'wallet', list: (wid) => walletBalances(wid) },
  budgets: {
    model: Budget,
    schema: budgetSchema,
    label: 'budget',
    sort: { endDate: -1 },
    unset: 'budget',
    list: (wid) => budgetsWithStatus(wid),
    // Changing the limit or dates means the alerts already sent no longer apply.
    beforeUpdate: (data) => ({ ...data, alerted: [] }),
  },
  goals: { model: SavingsGoal, schema: goalSchema, label: 'savings goal', sort: { createdAt: -1 } },
  recurring: { model: RecurringTransaction, schema: recurringSchema, label: 'recurring item', sort: { nextRun: 1 }, populate: 'category' },
  debts: { model: Debt, schema: debtSchema, label: 'debt', sort: { createdAt: -1 }, title: (d) => `${d.direction} - ${d.person}` },
  subscriptions: { model: Subscription, schema: subscriptionSchema, label: 'subscription', sort: { nextPayment: 1 }, populate: 'category' },
};

export const titleOf = (cfg, doc) => (cfg.title ? cfg.title(doc) : doc.name);

export async function clearReferences(cfg, wid, id) {
  if (cfg.unset) await Transaction.updateMany({ workspace: wid, [cfg.unset]: id }, { $set: { [cfg.unset]: null } });
  if (cfg.unset === 'category') await Budget.updateMany({ workspace: wid }, { $pull: { categories: id } });
}
