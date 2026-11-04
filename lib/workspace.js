import { Workspace, WorkspaceMember, Category, Wallet, User } from '@/models';

export const MAX_MEMBERS = 4;

const EXPENSES = [
  ['Food & Groceries', 'ShoppingBasket', '#2a78d6'],
  ['Transportation', 'Car', '#eb6834'],
  ['Shopping', 'ShoppingBag', '#1baf7a'],
  ['Bills & Utilities', 'Zap', '#eda100'],
  ['Education', 'GraduationCap', '#e87ba4'],
  ['Healthcare', 'HeartPulse', '#008300'],
  ['Entertainment', 'Clapperboard', '#6250d6'],
  ['Rent', 'House', '#e34948'],
  ['Travel', 'Plane', '#0e9aa7'],
  ['Other', 'Tag', '#6b7280'],
];
const INCOMES = [
  ['Salary', 'Banknote', '#2a78d6'],
  ['Freelancing', 'Laptop', '#eb6834'],
  ['Business', 'Store', '#1baf7a'],
  ['Investments', 'TrendingUp', '#eda100'],
  ['Gifts', 'Gift', '#e87ba4'],
  ['Other Income', 'Coins', '#6b7280'],
];

async function seed(workspaceId) {
  const cats = [
    ...EXPENSES.map(([name, icon, color]) => ({ name, icon, color, kind: 'expense' })),
    ...INCOMES.map(([name, icon, color]) => ({ name, icon, color, kind: 'income' })),
  ].map((c) => ({ ...c, workspace: workspaceId, isDefault: true }));
  await Category.insertMany(cats);
  await Wallet.insertMany([
    { workspace: workspaceId, name: 'Cash', type: 'cash', color: '#0f7a55' },
    { workspace: workspaceId, name: 'Bank', type: 'bank', color: '#2563a8' },
  ]);
}

export async function createWorkspace({ name, type, owner, currency }) {
  const ws = await Workspace.create({ name, type, owner: owner._id, currency: currency || owner.currency });
  await WorkspaceMember.create({ workspace: ws._id, user: owner._id, role: 'owner' });
  await seed(ws._id);
  return ws;
}

export async function createPersonalWorkspace(user) {
  const ws = await createWorkspace({ name: 'Personal', type: 'personal', owner: user });
  await User.updateOne({ _id: user._id }, { personalWorkspace: ws._id });
  return ws;
}

/** Evaluates what a member may do. Owners can do everything, viewers can only read. */
export function can(member, perm) {
  if (!member) return false;
  if (perm === 'read') return true;
  if (member.role === 'owner') return true;
  if (member.role === 'viewer' || perm === 'manage') return false;
  return { add: member.canAdd, edit: member.canEdit, delete: member.canDelete }[perm] === true;
}
