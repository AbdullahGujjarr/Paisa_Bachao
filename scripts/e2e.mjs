// End-to-end check against a running server with an empty test database.
// Usage: BASE=http://localhost:3100 CRON_SECRET_SOURCE=<AUTH_SECRET> node scripts/e2e.mjs
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { io } from 'socket.io-client';

const BASE = process.env.BASE || 'http://localhost:3100';
let passed = 0;
const failures = [];
async function check(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push(name);
    console.log(`FAIL  ${name}\n      ${err.message.split('\n').slice(0, 6).join('\n      ')}`);
  }
}

class Client {
  constructor(name) {
    this.name = name;
    this.email = `${name.toLowerCase()}-${Date.now()}@test.local`;
    this.password = 'test-password-123';
    this.jar = new Map();
  }
  store(res) {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
  cookie() {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  async raw(path, init = {}) {
    const res = await fetch(BASE + path, { redirect: 'manual', ...init, headers: { cookie: this.cookie(), ...init.headers } });
    this.store(res);
    return res;
  }
  async req(method, path, body, form) {
    const res = await this.raw(path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: form || (body ? JSON.stringify(body) : undefined),
    });
    const data = await res.json().catch(() => null);
    return { status: res.status, data };
  }
  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b); }
  patch(p, b) { return this.req('PATCH', p, b); }
  del(p, b) { return this.req('DELETE', p, b); }
  async login(password = this.password) {
    const { csrfToken } = await (await this.raw('/api/auth/csrf')).json();
    await this.raw('/api/auth/callback/credentials', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrfToken, email: this.email, password, callbackUrl: BASE }),
    });
    const me = await this.get('/api/account');
    if (me.status === 200) {
      this.id = me.data.user.id;
      this.personal = me.data.workspaces.find((w) => w.type === 'personal').id;
    }
    return me;
  }
  async register() {
    const r = await this.post('/api/account/register', { name: this.name, email: this.email, password: this.password });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const me = await this.login();
    assert.equal(me.status, 200);
  }
}

const tx = (over = {}) => ({ type: 'expense', name: 'Lunch', amount: 500, date: new Date().toISOString(), ...over });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const upload = (file, name, type) => {
  const f = new FormData();
  f.append('file', new Blob([file], { type }), name);
  return f;
};

const [ali, sara, omar, zara, hina, eve] = ['Ali', 'Sara', 'Omar', 'Zara', 'Hina', 'Eve'].map((n) => new Client(n));

console.log('\nAuth');
await check('registration creates accounts and sessions', async () => {
  for (const c of [ali, sara, omar, zara, hina, eve]) await c.register();
});
await check('duplicate email is refused', async () => {
  assert.equal((await ali.post('/api/account/register', { name: 'x', email: ali.email, password: 'whatever-long' })).status, 409);
});
await check('weak password is refused', async () => {
  assert.equal((await new Client('W').post('/api/account/register', { name: 'x', email: 'w@test.local', password: 'short' })).status, 422);
});
await check('wrong password does not sign in', async () => {
  const c = new Client('Ali');
  c.email = ali.email;
  assert.equal((await c.login('wrong-password')).status, 401);
});
await check('anonymous API access is refused', async () => {
  assert.equal((await new Client('X').get(`/api/w/${ali.personal}/summary`)).status, 401);
});
await check('forgot password gives the same reply for unknown emails', async () => {
  const c = new Client('X');
  assert.equal((await c.post('/api/account/forgot', { email: 'nobody@test.local' })).status, 200);
});

let cats;
let wallets;
const w = (p) => `/api/w/${ali.personal}/${p}`;

console.log('\nCash Book');
await check('new workspace has default categories and wallets', async () => {
  cats = (await ali.get(w('categories'))).data;
  wallets = (await ali.get(w('wallets'))).data;
  assert.equal(cats.filter((c) => c.kind === 'expense').length, 10);
  assert.equal(cats.filter((c) => c.kind === 'income').length, 6);
  assert.equal(wallets.length, 2);
});
const food = () => cats.find((c) => c.name === 'Food & Groceries')._id;
const salary = () => cats.find((c) => c.name === 'Salary')._id;
let txId;
await check('add, edit, duplicate, delete a transaction', async () => {
  const a = await ali.post(w('transactions'), tx({ category: food(), wallet: wallets[0]._id, tags: ['test'] }));
  assert.equal(a.status, 200, JSON.stringify(a.data));
  txId = a.data._id;
  const e = await ali.patch(w(`transactions/${txId}`), { amount: 750 });
  assert.equal(e.data.amount, 750);
  const d = await ali.post(w(`transactions/${txId}/duplicate`));
  assert.equal(d.status, 200);
  assert.equal((await ali.del(w(`transactions/${d.data._id}`))).status, 200);
});
await check('search and filters work', async () => {
  await ali.post(w('transactions'), tx({ name: 'Salary Oct', type: 'income', amount: 100000, category: salary() }));
  assert.equal((await ali.get(w('transactions?q=salary'))).data.total, 1);
  assert.equal((await ali.get(w('transactions?type=income'))).data.income, 100000);
  assert.equal((await ali.get(w('transactions?tag=test'))).data.total, 1);
  assert.equal((await ali.get(w('transactions?min=500&max=800'))).data.total, 1);
});
await check('search text cannot act as a regex or operator', async () => {
  assert.equal((await ali.get(w(`transactions?q=${encodeURIComponent('.*')}`))).data.total, 0);
  assert.equal((await ali.get(w(`transactions?category[$ne]=x`))).status, 200);
});
await check('invalid data is refused', async () => {
  assert.equal((await ali.post(w('transactions'), tx({ amount: -5 }))).status, 422);
  assert.equal((await ali.post(w('transactions'), tx({ name: '' }))).status, 422);
  assert.equal((await ali.post(w('transactions'), { ...tx(), amount: { $gt: 0 } })).status, 422);
});

console.log('\nIsolation');
await check("another user cannot read or change a private workspace", async () => {
  assert.equal((await sara.get(w('summary'))).status, 404);
  assert.equal((await sara.get(w('transactions'))).status, 404);
  assert.equal((await sara.post(w('transactions'), tx())).status, 404);
  assert.equal((await sara.del(w(`transactions/${txId}`))).status, 404);
});
await check("an id from another workspace is rejected, even in one's own", async () => {
  const s = `/api/w/${sara.personal}/`;
  assert.equal((await sara.post(`${s}transactions`, tx({ category: food() }))).status, 422);
  assert.equal((await sara.patch(`${s}transactions/${txId}`, { amount: 1 })).status, 404);
  assert.equal((await sara.del(`${s}categories/${food()}`)).status, 404);
});
await check('cross-site writes are blocked', async () => {
  const res = await ali.raw(w('transactions'), { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify(tx()) });
  assert.equal(res.status, 403);
});

console.log('\nBudgets and analytics');
await check('budget tracks spending and alerts fire once', async () => {
  const now = new Date();
  const b = await ali.post(w('budgets'), {
    name: 'Groceries', amount: 1000, categories: [food()],
    startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59).toISOString(),
  });
  assert.equal(b.status, 200, JSON.stringify(b.data));
  await ali.post(w('transactions'), tx({ name: 'Food 2', amount: 100, category: food() }));
  const list = (await ali.get(w('budgets'))).data;
  assert.equal(list[0].spent, 850);
  assert.equal(list[0].remaining, 150);
  const titles = (await ali.get('/api/notifications')).data.items.map((n) => n.title);
  assert.ok(titles.some((t) => t.includes('75% used')), titles.join('|'));
  await ali.post(w('transactions'), tx({ name: 'Food 3', amount: 300, category: food() }));
  const after = (await ali.get('/api/notifications')).data.items.map((n) => n.title);
  assert.ok(after.some((t) => t.includes('over budget')), after.join('|'));
  assert.equal(after.filter((t) => t.includes('75% used')).length, 1);
});
await check('analytics match the recorded transactions', async () => {
  const a = (await ali.get(w('analytics?preset=month'))).data;
  assert.equal(a.totals.income, 100000);
  assert.equal(a.totals.expense, 1150);
  assert.equal(a.stats.topCategory.name, 'Food & Groceries');
  assert.equal(a.stats.largest.amount, 750);
  assert.equal(a.series.reduce((s, p) => s + p.expense, 0), 1150);
  assert.equal(a.months.length, 12);
  for (const p of ['day', 'week', 'year']) assert.equal((await ali.get(w(`analytics?preset=${p}`))).status, 200);
});
await check('dashboard summary is consistent', async () => {
  const s = (await ali.get(w('summary'))).data;
  assert.equal(s.balance, 98850);
  assert.equal(s.recent.length, 4);
  assert.ok(s.forecast.projected >= 1150);
  assert.equal(s.wallets.find((x) => x.name === 'Cash').balance, -750);
});

console.log('\nShared workspaces');
let shared;
const sw = (p) => `/api/w/${shared}/${p}`;
const tokenOf = (url) => url.split('/invite/')[1];
await check('personal workspaces cannot invite anyone', async () => {
  assert.equal((await ali.post(w('invites'), { role: 'editor' })).status, 400);
});
await check('owner creates a shared workspace and members join', async () => {
  shared = (await ali.post('/api/workspaces', { name: 'Family', currency: 'PKR' })).data.id;
  const one = await ali.post(sw('invites'), { role: 'editor' });
  assert.equal((await sara.get(`/api/invites/${tokenOf(one.data.url)}`)).data.workspace, 'Family');
  assert.equal((await sara.post(`/api/invites/${tokenOf(one.data.url)}`, { accept: true })).status, 200);
  const two = await ali.post(sw('invites'), { role: 'viewer' });
  assert.equal((await omar.post(`/api/invites/${tokenOf(two.data.url)}`, { accept: true })).status, 200);
  assert.equal((await ali.get(sw('members'))).data.length, 3);
});
await check('email invites only work for that email', async () => {
  const inv = await ali.post(sw('invites'), { email: zara.email, role: 'editor' });
  assert.equal((await hina.post(`/api/invites/${tokenOf(inv.data.url)}`, { accept: true })).status, 403);
});
await check('shared members still cannot see personal workspaces', async () => {
  assert.equal((await sara.get(w('summary'))).status, 404);
  assert.equal((await ali.get(`/api/w/${sara.personal}/summary`)).status, 404);
});
await check('viewers can read but not write', async () => {
  assert.equal((await omar.get(sw('summary'))).status, 200);
  assert.equal((await omar.post(sw('transactions'), tx())).status, 403);
  assert.equal((await omar.post(sw('invites'), {})).status, 403);
});
await check('owner permission switches are enforced', async () => {
  const t = (await sara.post(sw('transactions'), tx({ name: 'Sara lunch' }))).data;
  assert.equal((await ali.patch(sw(`members/${sara.id}`), { canDelete: false })).status, 200);
  assert.equal((await sara.del(sw(`transactions/${t._id}`))).status, 403);
  assert.equal((await sara.patch(sw(`transactions/${t._id}`), { amount: 600 })).status, 200);
  await ali.patch(sw(`members/${sara.id}`), { canDelete: true });
  assert.equal((await sara.patch(sw(`members/${omar.id}`), { role: 'editor' })).status, 403);
});
await check('activity records who did what', async () => {
  const items = (await ali.get(sw('activity'))).data.items.map((a) => a.summary);
  assert.ok(items.some((s) => s.startsWith('Sara added Sara lunch')), items.join('|'));
  assert.ok(items.some((s) => s.startsWith('Sara edited')));
});
await check('the 4-member limit holds under simultaneous accepts', async () => {
  const link = await ali.post(sw('invites'), { role: 'editor' });
  const token = tokenOf(link.data.url);
  const results = await Promise.all([zara, hina, eve].map((c) => c.post(`/api/invites/${token}`, { accept: true })));
  const ok = results.filter((r) => r.status === 200).length;
  assert.equal(ok, 1, `expected one seat, got ${ok}: ${results.map((r) => r.status)}`);
  assert.equal((await ali.get(sw('members'))).data.length, 4);
  assert.equal((await ali.post(sw('invites'), {})).status, 409);
});
await check('settlement says who owes whom', async () => {
  const s = (await ali.get(sw('settlement'))).data;
  assert.equal(s.total, 600);
  assert.equal(s.share, 150);
  assert.equal(s.transfers.reduce((a, t) => a + t.amount, 0), 450);
  assert.ok(s.transfers.every((t) => t.to === sara.id));
  const t = s.transfers[0];
  assert.equal((await ali.post(sw('settlement'), { from: t.from, to: t.to, amount: t.amount })).status, 200);
  assert.equal((await ali.get(sw('settlement'))).data.transfers.length, 2);
});

console.log('\nReal-time');
const connect = async (c) => {
  const { ticket } = (await c.get('/api/realtime/token')).data;
  return new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { ticket }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
    setTimeout(() => reject(new Error('socket timeout')), 5000);
  });
};
const join = (s, id) => new Promise((r) => s.emit('join', id, r));
const nextEvent = (s, name, ms = 2000) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`no ${name} event within ${ms}ms`)), ms);
    s.once(name, (e) => {
      clearTimeout(t);
      resolve(e);
    });
  });
await check('a socket without a valid ticket is refused', async () => {
  await assert.rejects(
    new Promise((resolve, reject) => {
      const s = io(BASE, { auth: { ticket: 'forged.ticket' }, transports: ['websocket'], reconnection: false });
      s.on('connect', resolve);
      s.on('connect_error', reject);
    }),
  );
});
await check("a non-member cannot join a workspace's live updates", async () => {
  const s = await connect(eve.jar.size && (await eve.get(sw('summary'))).status === 404 ? eve : hina);
  assert.equal((await join(s, shared)).ok, false);
  s.disconnect();
});
await check('one member adding a transaction reaches the others instantly', async () => {
  const s = await connect(sara);
  assert.equal((await join(s, shared)).ok, true);
  const start = Date.now();
  const event = nextEvent(s, 'changed');
  await ali.post(sw('transactions'), tx({ name: 'Live test' }));
  const e = await event;
  console.log(`      delivered in ${Date.now() - start}ms`);
  assert.equal(e.byName, 'Ali');
  assert.match(e.summary, /Live test/);
  s.disconnect();
});
await check('a removed member stops receiving updates at once', async () => {
  const s = await connect(omar);
  await join(s, shared);
  assert.equal((await ali.del(sw(`members/${omar.id}`))).status, 200);
  await wait(100);
  await assert.rejects(Promise.all([nextEvent(s, 'changed', 700), ali.post(sw('transactions'), tx({ name: 'After removal' }))]));
  assert.equal((await omar.get(sw('summary'))).status, 404);
  s.disconnect();
});

console.log('\nRecurring and reminders');
const cron = async () => {
  const secret = crypto.createHash('sha256').update(`cron:${process.env.CRON_SECRET_SOURCE}`).digest('hex');
  const res = await fetch(`${BASE}/api/internal/cron`, { method: 'POST', headers: { 'x-cron-secret': secret } });
  return { status: res.status, data: await res.json() };
};
await check('the job endpoint refuses a wrong secret', async () => {
  const res = await fetch(`${BASE}/api/internal/cron`, { method: 'POST', headers: { 'x-cron-secret': 'ab'.repeat(32) } });
  assert.equal(res.status, 404);
});
await check('due recurring items post once and move to the next date', async () => {
  const start = new Date(Date.now() - 3 * 86400000).toISOString();
  const r = await sara.post(`/api/w/${sara.personal}/recurring`, { type: 'expense', name: 'Daily tea', amount: 50, frequency: 'daily', nextRun: start });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal((await cron()).status, 200);
  const t1 = (await sara.get(`/api/w/${sara.personal}/transactions?q=Daily`)).data.total;
  assert.equal(t1, 4);
  await cron();
  assert.equal((await sara.get(`/api/w/${sara.personal}/transactions?q=Daily`)).data.total, 4);
  const rule = (await sara.get(`/api/w/${sara.personal}/recurring`)).data[0];
  assert.ok(new Date(rule.nextRun) > new Date());
});
await check('subscription reminder is sent once; mark-as-paid posts it and rolls the date', async () => {
  const s = `/api/w/${sara.personal}/`;
  const sub = (await sara.post(`${s}subscriptions`, { name: 'Internet', amount: 3000, nextPayment: new Date(Date.now() + 86400000).toISOString() })).data;
  await cron();
  await cron();
  const items = (await sara.get('/api/notifications')).data.items.filter((n) => n.title.includes('Internet'));
  assert.equal(items.length, 1);
  const paid = await sara.post(`${s}subscriptions/${sub._id}/pay`);
  assert.equal(paid.status, 200);
  assert.ok(new Date(paid.data.nextPayment) > new Date(sub.nextPayment));
  assert.equal((await sara.get(`${s}transactions?q=Internet`)).data.total, 1);
});
await check('debts record repayments and refuse overpayment', async () => {
  const s = `/api/w/${sara.personal}/`;
  const d = (await sara.post(`${s}debts`, { direction: 'lent', person: 'Bilal', amount: 1000 })).data;
  assert.equal((await sara.post(`${s}debts/${d._id}/payments`, { amount: 400 })).data.paid, 400);
  assert.equal((await sara.post(`${s}debts/${d._id}/payments`, { amount: 700 })).status, 422);
});
await check('savings goals update', async () => {
  const s = `/api/w/${sara.personal}/`;
  const g = (await sara.post(`${s}goals`, { name: 'Bike', targetAmount: 50000 })).data;
  assert.equal((await sara.patch(`${s}goals/${g._id}`, { savedAmount: 5000 })).data.savedAmount, 5000);
});

console.log('\nReceipt scanning (free OCR path)');
const receiptSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="620"><rect width="100%" height="100%" fill="white"/>
<g font-family="Courier New, monospace" font-size="30" fill="black">
<text x="40" y="60">CITY MART</text><text x="40" y="110">Date 12/10/2026</text>
<text x="40" y="190">Milk 2 x 200 400</text><text x="40" y="240">Bread 1 150</text>
<text x="40" y="290">Eggs 12 360</text><text x="40" y="340">Rice 2 kg 600</text>
<text x="40" y="420">Tax 100</text><text x="40" y="480">Grand Total 1610</text></g></svg>`;
const png = await sharp(Buffer.from(receiptSvg)).png().toBuffer();
let scanId;
const scanPath = (p = '') => `/api/w/${sara.personal}/scan${p}`;
const noneSaved = async () => (await sara.get(`/api/w/${sara.personal}/transactions?q=CITY`)).data.total;
await check('a PNG receipt becomes a table of items', async () => {
  const r = await sara.req('POST', scanPath(), null, upload(png, 'receipt.png', 'image/png'));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  scanId = r.data._id;
  console.log(`      read: ${r.data.items.map((i) => `${i.name}=${i.price}`).join(', ')} | total ${r.data.total} tax ${r.data.tax}`);
  assert.equal(r.data.method, 'ocr');
  assert.equal(r.data.total, 1610);
  assert.equal(r.data.tax, 100);
  assert.deepEqual(r.data.items.map((i) => i.price), [400, 150, 360, 600]);
});
await check('nothing is saved until the user confirms', async () => {
  assert.equal(await noneSaved(), 0);
});
await check('confirming saves once, and a second save is refused', async () => {
  const body = { scanId, mode: 'single', store: 'CITY MART', date: new Date().toISOString(), items: [{ name: 'Milk', quantity: '2', price: 400 }, { name: 'Bread', price: 150 }], tax: 50 };
  const a = await sara.post(scanPath('/save'), body);
  assert.equal(a.status, 200, JSON.stringify(a.data));
  assert.equal(a.data.total, 600);
  assert.equal((await sara.post(scanPath('/save'), body)).status, 409);
  assert.equal(await noneSaved(), 1);
});
await check('JPEG and WebP also work', async () => {
  for (const [buf, name] of [[await sharp(png).jpeg().toBuffer(), 'r.jpg'], [await sharp(png).webp().toBuffer(), 'r.webp']]) {
    const r = await sara.req('POST', scanPath(), null, upload(buf, name, 'application/octet-stream'));
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.ok(r.data.items.length >= 3, name);
  }
});
const pdfOf = (draw) =>
  new Promise((resolve) => {
    const d = new PDFDocument({ size: 'A5' });
    const out = [];
    d.on('data', (c) => out.push(c));
    d.on('end', () => resolve(Buffer.concat(out)));
    draw(d);
    d.end();
  });
await check('a text PDF is read directly', async () => {
  const pdf = await pdfOf((d) => d.fontSize(14).text('CITY MART').text('Milk 400').text('Bread 150').text('Grand Total 550'));
  const r = await sara.req('POST', scanPath(), null, upload(pdf, 'bill.pdf', 'application/pdf'));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.method, 'pdf-text');
  assert.equal(r.data.total, 550);
});
await check('a scanned PDF with no text is rendered and read by OCR', async () => {
  const pdf = await pdfOf((d) => d.image(png, 20, 20, { width: 360 }));
  const r = await sara.req('POST', scanPath(), null, upload(pdf, 'scan.pdf', 'application/pdf'));
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.method, 'ocr');
  assert.ok(r.data.items.length >= 3, JSON.stringify(r.data.items));
});
await check('files are judged by content, not extension', async () => {
  const bad = Buffer.from('<script>alert(1)</script> not an image at all');
  assert.equal((await sara.req('POST', scanPath(), null, upload(bad, 'fake.png', 'image/png'))).status, 415);
  assert.equal((await sara.req('POST', '/api/upload', null, upload(bad, 'fake.jpg', 'image/jpeg'))).status, 415);
});
await check('oversized files are refused', async () => {
  const big = Buffer.concat([png, Buffer.alloc(16 * 1024 * 1024)]);
  assert.equal((await sara.req('POST', scanPath(), null, upload(big, 'big.png', 'image/png'))).status, 413);
});
await check('uploaded files need a signed-in user', async () => {
  const up = await sara.req('POST', '/api/upload', null, upload(png, 'a.png', 'image/png'));
  assert.equal(up.status, 200);
  assert.equal((await sara.raw(up.data.url)).status, 200);
  assert.equal((await new Client('X').raw(up.data.url)).status, 401);
});

console.log('\nAssistant (free built-in answers)');
const ask = async (text) => (await ali.post(w('assistant'), { text })).data;
await check('answers come from real numbers', async () => {
  assert.match((await ask('How much did I spend this month?')).text, /Rs\. 1,150/);
  assert.match((await ask('How much did I spend on food this month?')).text, /Rs\. 1,150/);
  assert.match((await ask('Where does most of my money go?')).text, /Food & Groceries/);
  assert.match((await ask('Show my biggest expenses')).text, /Lunch: Rs\. 750/);
  assert.match((await ask('Compare my spending this month with last month')).text, /Rs\. 1,150/);
  assert.match((await ask('How much can I safely spend today?')).text, /safely spend/);
  assert.match((await ask('Which category should I reduce?')).text, /Food & Groceries/);
});
await check('it proposes a transaction but never saves one', async () => {
  const before = (await ali.get(w('transactions'))).data.total;
  const r = await ask('spent 500 on groceries');
  assert.equal(r.proposal.amount, 500);
  assert.equal(r.proposal.categoryName, 'Food & Groceries');
  assert.equal((await ali.get(w('transactions'))).data.total, before);
});

console.log('\nReports');
const report = async (q) => {
  const res = await ali.raw(w(`reports?${q}`));
  return { res, buf: Buffer.from(await res.arrayBuffer()) };
};
await check('PDF, Excel and CSV download with the right format', async () => {
  const pdf = await report('kind=monthly&format=pdf');
  assert.equal(pdf.res.status, 200, pdf.buf.toString().slice(0, 200));
  assert.equal(pdf.buf.subarray(0, 5).toString(), '%PDF-');
  assert.match(pdf.res.headers.get('content-disposition'), /attachment; filename="PaisaBachao-monthly/);
  const xlsx = await report('kind=yearly&format=xlsx');
  assert.equal(xlsx.res.status, 200);
  assert.equal(xlsx.buf.subarray(0, 2).toString(), 'PK');
  const csv = await report('kind=cashbook&format=csv');
  assert.match(csv.buf.toString(), /Salary Oct/);
});
await check('every report type works', async () => {
  const budget = (await ali.get(w('budgets'))).data[0]._id;
  for (const q of ['kind=daily', 'kind=weekly', 'kind=custom&from=2026-01-01&to=2026-12-31', `kind=budget&budget=${budget}`, `kind=category&category=${food()}`, 'kind=cashbook']) {
    const r = await report(`${q}&format=pdf`);
    assert.equal(r.res.status, 200, `${q}: ${r.buf.toString().slice(0, 120)}`);
  }
});
await check('a formula in a transaction name is neutralised in CSV', async () => {
  await ali.post(w('transactions'), tx({ name: '=HYPERLINK("http://x")', amount: 1 }));
  assert.match((await report('kind=cashbook&format=csv')).buf.toString(), /'=HYPERLINK/);
});
await check('reports cannot be pulled from someone else’s workspace', async () => {
  assert.equal((await sara.get(w('reports?kind=monthly&format=csv'))).status, 404);
});

console.log('\nAccount');
await check('changing a password ends other sessions', async () => {
  const other = new Client('Hina');
  other.email = hina.email;
  await other.login();
  assert.equal((await hina.post('/api/account/password', { current: 'nope', next: 'new-password-456' })).status, 400);
  assert.equal((await hina.post('/api/account/password', { current: hina.password, next: 'new-password-456' })).status, 200);
  assert.equal((await other.get('/api/account')).status, 401);
});
await check('deleting an owner passes the shared workspace on and removes their data', async () => {
  assert.equal((await ali.del('/api/account', { password: 'wrong' })).status, 400);
  assert.equal((await ali.del('/api/account', { password: ali.password })).status, 200);
  assert.equal((await ali.get('/api/account')).status, 401);
  const members = (await sara.get(sw('members'))).data;
  assert.equal(members.find((m) => m.id === sara.id).role, 'owner');
  assert.equal(members.length, 2);
  assert.equal((await sara.get(`${w('summary')}`)).status, 404);
});

console.log(`\n${passed} passed, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
