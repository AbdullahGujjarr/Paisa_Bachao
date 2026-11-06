import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid reference');
const optId = objectId.nullish().or(z.literal('').transform(() => null));
const money = z.coerce.number().finite().min(0).max(1e12).transform((n) => Math.round(n * 100) / 100);
const positive = money.refine((n) => n > 0, 'Must be more than 0');
const date = z.coerce.date();
const optDate = z.preprocess((v) => (v === '' ? null : v), z.coerce.date().nullish());
const text = (max) => z.string().trim().max(max);
const name = (max) => z.string().trim().min(1, 'Required').max(max);

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email').max(160);
export const passwordSchema = z.string().min(8, 'Use at least 8 characters').max(128);

export const registerSchema = z.object({ name: name(80), email: emailSchema, password: passwordSchema });

export const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  name: name(120),
  amount: positive,
  category: optId,
  wallet: optId,
  budget: optId,
  date,
  paymentMethod: text(30).default('cash'),
  description: text(500).optional(),
  notes: text(1000).optional(),
  tags: z.array(text(30)).max(10).default([]),
  paidBy: optId,
  attachments: z
    .array(z.object({ url: text(500), name: text(200), mime: text(80) }))
    .max(5)
    .default([]),
});

export const budgetSchema = z
  .object({
    name: name(80),
    kind: text(30).default('personal'),
    amount: positive,
    startDate: date,
    endDate: date,
    categories: z.array(objectId).max(40).default([]),
  })
  .refine((b) => b.endDate >= b.startDate, { message: 'End date must be after the start date', path: ['endDate'] });

export const categorySchema = z.object({
  name: name(40),
  kind: z.enum(['income', 'expense']),
  icon: text(30).default('Tag'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#0f7a55'),
});

export const walletSchema = z.object({
  name: name(40),
  type: z.enum(['cash', 'bank', 'digital', 'card', 'other']).default('cash'),
  openingBalance: z.coerce.number().finite().min(-1e12).max(1e12).default(0),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#0f7a55'),
});

export const goalSchema = z.object({
  name: name(80),
  targetAmount: positive,
  savedAmount: money.default(0),
  deadline: optDate,
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default('#0f7a55'),
});

export const recurringSchema = z.object({
  type: z.enum(['income', 'expense']),
  name: name(120),
  amount: positive,
  category: optId,
  wallet: optId,
  paymentMethod: text(30).default('cash'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  nextRun: date,
  endDate: optDate,
  active: z.boolean().default(true),
});

export const debtSchema = z.object({
  direction: z.enum(['lent', 'borrowed']),
  person: name(80),
  amount: positive,
  dueDate: optDate,
  notes: text(500).optional(),
});

export const subscriptionSchema = z.object({
  name: name(80),
  amount: positive,
  cycle: z.enum(['weekly', 'monthly', 'yearly']).default('monthly'),
  nextPayment: date,
  category: optId,
  remindDays: z.coerce.number().int().min(0).max(30).default(3),
  active: z.boolean().default(true),
});

export const paymentSchema = z.object({ amount: positive, date: date.default(() => new Date()), note: text(200).optional() });

export const profileSchema = z.object({
  name: name(80).optional(),
  image: text(500).nullish(),
  currency: z.string().regex(/^[A-Z]{3}$/).optional(),
  timezone: text(60).optional(),
  dateFormat: z.enum(['dd MMM yyyy', 'dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd']).optional(),
});

export const scanSaveSchema = z.object({
  scanId: objectId,
  mode: z.enum(['single', 'items']),
  store: text(120).optional(),
  date,
  category: optId,
  wallet: optId,
  budget: optId,
  paymentMethod: text(30).default('cash'),
  items: z
    .array(z.object({ name: name(120), quantity: text(20).optional(), price: positive }))
    .min(1, 'Add at least one row')
    .max(200),
  tax: money.default(0),
});

export const inviteSchema = z.object({ email: emailSchema.optional().or(z.literal('')) });

export const settlementSchema = z.object({ from: objectId, to: objectId, amount: positive, date: date.default(() => new Date()), note: text(200).optional() });
