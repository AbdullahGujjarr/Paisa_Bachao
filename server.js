// Custom server: runs Next.js and Socket.IO in one Node process. Socket.IO needs a long-lived
// process, so host this on Render, Railway or a VPS rather than Vercel.
const { createServer } = require('node:http');
const crypto = require('node:crypto');
const { loadEnvConfig } = require('@next/env');

// `node server.js --prod` works the same on Windows, macOS and Linux.
if (process.argv.includes('--prod')) process.env.NODE_ENV = 'production';
const dev = process.env.NODE_ENV !== 'production';
loadEnvConfig(process.cwd(), dev);
// Sign-in needs the public address. Without this it would use the 0.0.0.0 bind address.
process.env.AUTH_URL ||= process.env.APP_URL;

const next = require('next');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || '0.0.0.0';

function verifyTicket(ticket) {
  const [body, sig] = String(ticket || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', process.env.AUTH_SECRET).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
  return data.exp > Date.now() ? data.uid : null;
}

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const db = mongoose.createConnection(process.env.MONGODB_URI);
  await db.asPromise();
  const members = db.collection('workspacemembers');

  const server = createServer((req, res) => handle(req, res));
  // destroyUpgrade off: Next's dev server needs its own websocket upgrades left alone.
  const io = new Server(server, { path: '/socket.io', destroyUpgrade: false, serveClient: false });
  globalThis.__pbIo = io;

  io.use((socket, nextFn) => {
    const uid = verifyTicket(socket.handshake.auth?.ticket);
    if (!uid) return nextFn(new Error('unauthorized'));
    socket.data.uid = uid;
    nextFn();
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.uid}`);
    socket.on('join', async (workspaceId, ack) => {
      try {
        if (!mongoose.isObjectIdOrHexString(workspaceId)) throw new Error('bad id');
        const member = await members.findOne({
          workspace: new mongoose.Types.ObjectId(workspaceId),
          user: new mongoose.Types.ObjectId(socket.data.uid),
        });
        if (!member) throw new Error('not a member');
        for (const room of socket.rooms) if (room.startsWith('ws:')) socket.leave(room);
        socket.join(`ws:${workspaceId}`);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false });
      }
    });
  });

  if (dev) {
    const upgrade = app.getUpgradeHandler?.();
    if (upgrade) {
      server.on('upgrade', (req, sock, head) => {
        if (!req.url.startsWith('/socket.io')) upgrade(req, sock, head);
      });
    }
  }

  server.listen(port, hostname, () => console.log(`PaisaBachao ready on http://localhost:${port}`));

  // Posts due recurring items and sends payment reminders.
  const secret = crypto.createHash('sha256').update(`cron:${process.env.AUTH_SECRET}`).digest('hex');
  const runCron = () =>
    fetch(`http://127.0.0.1:${port}/api/internal/cron`, { method: 'POST', headers: { 'x-cron-secret': secret } }).catch(
      (err) => console.error('[cron]', err.message),
    );
  setTimeout(runCron, 15_000);
  setInterval(runCron, 15 * 60_000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
