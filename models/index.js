import mongoose from 'mongoose';

const { Schema, Types } = mongoose;
const ref = (model, extra = {}) => ({ type: Types.ObjectId, ref: model, ...extra });
const wsRef = { type: Types.ObjectId, ref: 'Workspace', required: true, index: true };
const model = (name, schema) => mongoose.models[name] || mongoose.model(name, schema);
const opts = { timestamps: true };

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, select: false },
    image: String,
    emailVerified: Date,
    providers: { type: [String], default: [] },
    currency: { type: String, default: 'PKR' },
    timezone: { type: String, default: 'Asia/Karachi' },
    dateFormat: { type: String, default: 'dd MMM yyyy' },
    // Bumped on password change and "log out everywhere", which invalidates every older session.
    sessionVersion: { type: Number, default: 0 },
    personalWorkspace: ref('Workspace'),
    verifyTokenHash: { type: String, select: false },
    verifyExpires: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetExpires: { type: Date, select: false },
  },
  opts,
);

const WorkspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    type: { type: String, enum: ['personal', 'shared'], required: true },
    owner: ref('User', { required: true, index: true }),
    currency: { type: String, default: 'PKR' },
    // Maintained atomically so the member limit holds when invites are accepted concurrently.
    memberCount: { type: Number, default: 1 },
  },
  opts,
);

const WorkspaceMemberSchema = new Schema(
  {
    workspace: wsRef,
    user: ref('User', { required: true, index: true }),
    role: { type: String, enum: ['owner', 'editor', 'viewer'], required: true },
    canAdd: { type: Boolean, default: true },
    canEdit: { type: Boolean, default: true },
    canDelete: { type: Boolean, default: true },
    lastSeenAt: Date,
  },
  opts,
);
WorkspaceMemberSchema.index({ workspace: 1, user: 1 }, { unique: true });

const TransactionSchema = new Schema(
  {
    workspace: wsRef,
    type: { type: String, enum: ['income', 'expense'], required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 0 },
    category: ref('Category'),
    wallet: ref('Wallet'),
    budget: ref('Budget'),
    date: { type: Date, required: true },
    paymentMethod: { type: String, default: 'cash' },
    description: { type: String, maxlength: 500 },
    notes: { type: String, maxlength: 1000 },
    attachments: [{ url: String, name: String, mime: String, _id: false }],
    tags: { type: [String], default: [] },
    paidBy: ref('User'),
    createdBy: ref('User', { required: true }),
    updatedBy: ref('User'),
    recurring: ref('RecurringTransaction'),
    receiptScan: ref('ReceiptScan'),
  },
  opts,
);
TransactionSchema.index({ workspace: 1, date: -1 });
TransactionSchema.index({ workspace: 1, type: 1, date: -1 });
TransactionSchema.index({ workspace: 1, category: 1, date: -1 });
TransactionSchema.index({ workspace: 1, budget: 1 });
// Stops a recurring rule from posting the same occurrence twice if two runs overlap.
TransactionSchema.index(
  { recurring: 1, date: 1 },
  { unique: true, partialFilterExpression: { recurring: { $type: 'objectId' } } },
);

const BudgetSchema = new Schema(
  {
    workspace: wsRef,
    name: { type: String, required: true, trim: true, maxlength: 80 },
    kind: { type: String, default: 'personal' },
    amount: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    categories: [ref('Category')],
    alerted: { type: [Number], default: [] },
    createdBy: ref('User'),
  },
  opts,
);
BudgetSchema.index({ workspace: 1, endDate: -1 });

const CategorySchema = new Schema(
  {
    workspace: wsRef,
    name: { type: String, required: true, trim: true, maxlength: 40 },
    kind: { type: String, enum: ['income', 'expense'], required: true },
    icon: { type: String, default: 'Tag' },
    color: { type: String, default: '#0f7a55' },
    isDefault: { type: Boolean, default: false },
  },
  opts,
);
CategorySchema.index({ workspace: 1, kind: 1, name: 1 }, { unique: true });

const WalletSchema = new Schema(
  {
    workspace: wsRef,
    name: { type: String, required: true, trim: true, maxlength: 40 },
    type: { type: String, enum: ['cash', 'bank', 'digital', 'card', 'other'], default: 'cash' },
    openingBalance: { type: Number, default: 0 },
    color: { type: String, default: '#0f7a55' },
  },
  opts,
);

const SavingsGoalSchema = new Schema(
  {
    workspace: wsRef,
    name: { type: String, required: true, trim: true, maxlength: 80 },
    targetAmount: { type: Number, required: true, min: 0 },
    savedAmount: { type: Number, default: 0, min: 0 },
    deadline: Date,
    color: { type: String, default: '#0f7a55' },
  },
  opts,
);

const RecurringSchema = new Schema(
  {
    workspace: wsRef,
    type: { type: String, enum: ['income', 'expense'], required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    amount: { type: Number, required: true, min: 0 },
    category: ref('Category'),
    wallet: ref('Wallet'),
    paymentMethod: { type: String, default: 'cash' },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly'], required: true },
    nextRun: { type: Date, required: true, index: true },
    endDate: Date,
    active: { type: Boolean, default: true },
    createdBy: ref('User'),
  },
  opts,
);

const DebtSchema = new Schema(
  {
    workspace: wsRef,
    direction: { type: String, enum: ['lent', 'borrowed'], required: true },
    person: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0 },
    paid: { type: Number, default: 0, min: 0 },
    dueDate: Date,
    notes: { type: String, maxlength: 500 },
    payments: [{ amount: Number, date: Date, note: String }],
  },
  opts,
);

const SubscriptionSchema = new Schema(
  {
    workspace: wsRef,
    name: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0 },
    cycle: { type: String, enum: ['weekly', 'monthly', 'yearly'], default: 'monthly' },
    nextPayment: { type: Date, required: true, index: true },
    category: ref('Category'),
    remindDays: { type: Number, default: 3, min: 0, max: 30 },
    active: { type: Boolean, default: true },
  },
  opts,
);

const NotificationSchema = new Schema(
  {
    user: ref('User', { required: true }),
    workspace: ref('Workspace'),
    kind: { type: String, default: 'info' },
    title: { type: String, required: true },
    body: String,
    link: String,
    read: { type: Boolean, default: false },
    dedupeKey: String,
  },
  opts,
);
NotificationSchema.index({ user: 1, read: 1, createdAt: -1 });
NotificationSchema.index(
  { user: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

const InvitationSchema = new Schema(
  {
    workspace: wsRef,
    email: { type: String, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, unique: true },
    role: { type: String, enum: ['editor', 'viewer'], default: 'editor' },
    invitedBy: ref('User', { required: true }),
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'revoked'], default: 'pending' },
    expiresAt: { type: Date, required: true },
  },
  opts,
);

const ReceiptScanSchema = new Schema(
  {
    workspace: wsRef,
    user: ref('User', { required: true }),
    file: { url: String, name: String, mime: String },
    method: { type: String, enum: ['ai', 'ocr', 'pdf-text'] },
    store: String,
    date: Date,
    items: [{ name: String, quantity: String, unitPrice: Number, price: Number, _id: false }],
    tax: Number,
    total: Number,
    rawText: String,
    savedAt: Date,
  },
  opts,
);

const ActivityLogSchema = new Schema(
  {
    workspace: wsRef,
    user: ref('User'),
    userName: String,
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: Types.ObjectId,
    summary: { type: String, required: true },
  },
  opts,
);
ActivityLogSchema.index({ workspace: 1, createdAt: -1 });

const SettlementSchema = new Schema(
  {
    workspace: wsRef,
    from: ref('User', { required: true }),
    to: ref('User', { required: true }),
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, required: true },
    note: String,
    createdBy: ref('User'),
  },
  opts,
);

export const User = model('User', UserSchema);
export const Workspace = model('Workspace', WorkspaceSchema);
export const WorkspaceMember = model('WorkspaceMember', WorkspaceMemberSchema);
export const Transaction = model('Transaction', TransactionSchema);
export const Budget = model('Budget', BudgetSchema);
export const Category = model('Category', CategorySchema);
export const Wallet = model('Wallet', WalletSchema);
export const SavingsGoal = model('SavingsGoal', SavingsGoalSchema);
export const RecurringTransaction = model('RecurringTransaction', RecurringSchema);
export const Debt = model('Debt', DebtSchema);
export const Subscription = model('Subscription', SubscriptionSchema);
export const Notification = model('Notification', NotificationSchema);
export const Invitation = model('Invitation', InvitationSchema);
export const ReceiptScan = model('ReceiptScan', ReceiptScanSchema);
export const ActivityLog = model('ActivityLog', ActivityLogSchema);
export const Settlement = model('Settlement', SettlementSchema);
