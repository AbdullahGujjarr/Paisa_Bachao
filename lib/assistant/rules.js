// Understands common finance questions without any AI service, so the assistant is free to run.

const PERIODS = [
  [/\btoday\b/, 'today'],
  [/\byesterday\b/, 'yesterday'],
  [/\blast\s+week\b/, 'lastWeek'],
  [/\b(this\s+week|weekly)\b/, 'thisWeek'],
  [/\b(last|previous)\s+month\b/, 'lastMonth'],
  [/\bthis\s+month\b/, 'thisMonth'],
  [/\blast\s+year\b/, 'lastYear'],
  [/\b(this\s+year|yearly)\b/, 'thisYear'],
];

const ALIASES = {
  food: 'food', grocery: 'food', groceries: 'food', transport: 'transport', petrol: 'transport', fuel: 'transport',
  bills: 'bills', utilities: 'bills', electricity: 'bills', rent: 'rent', school: 'education', fees: 'education',
  doctor: 'health', medicine: 'health', movies: 'entertainment',
};

export function matchCategory(text, names) {
  const words = text.match(/[a-z]+/g) || [];
  for (const name of names) if (text.includes(name.toLowerCase())) return name;
  for (const word of words) {
    if (word.length < 3) continue;
    const key = ALIASES[word] || word;
    const hit = names.find((n) => n.toLowerCase().split(/[^a-z]+/).some((part) => part.length > 2 && (part.startsWith(key) || key.startsWith(part))));
    if (hit) return hit;
  }
  return null;
}

export function parseQuestion(input, categoryNames = []) {
  const text = String(input).toLowerCase().trim();
  const period = PERIODS.find(([re]) => re.test(text))?.[1] || 'thisMonth';
  const add = text.match(/^(?:add|log|record|spent|paid)\b.*?(\d+(?:\.\d+)?)/);
  if (add && !/\bhow\b/.test(text)) {
    const isIncome = /\b(income|salary|received|earned)\b/.test(text);
    const label = text.match(/\b(?:on|for)\s+(.+)$/)?.[1]?.trim();
    return { intent: 'add', amount: Number(add[1]), type: isIncome ? 'income' : 'expense', label: label || null, category: matchCategory(label || text, categoryNames) };
  }
  if (/\bcompare\b|\bversus\b|\bvs\b/.test(text)) return { intent: 'compare' };
  if (/\bsafe(ly)?\b|\bcan i (spend|afford)\b/.test(text)) return { intent: 'safe' };
  if (/\b(reduce|cut|save more|cut back|lower)\b/.test(text)) return { intent: 'reduce' };
  if (/\b(biggest|largest|highest|top)\b.*\b(expenses?|transactions?|spending)\b/.test(text)) return { intent: 'biggest', period };
  if (/\bwhere\b.*\b(money|spend|go)\b|\bmost\b.*\b(spend|money|category)\b/.test(text)) return { intent: 'categories', period };
  if (/\bbudgets?\b/.test(text)) return { intent: 'budgets' };
  if (/\b(earn|earned|income|salary)\b/.test(text)) return { intent: 'income', period };
  if (/\b(save|saved|savings)\b/.test(text)) return { intent: 'savings', period };
  if (/\b(how much|spent|spend|spending|expenses?|total)\b/.test(text)) return { intent: 'spent', period, category: matchCategory(text, categoryNames) };
  return { intent: 'help' };
}
