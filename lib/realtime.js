import crypto from 'node:crypto';
import { ActivityLog } from '@/models';

// server.js creates the Socket.IO server in this same process and publishes it here.
const io = () => globalThis.__pbIo;

/** Tells everyone in a workspace that data changed, so their open screens refetch. */
export function broadcast(wid, payload = {}) {
  io()?.to(`ws:${wid}`).emit('changed', { workspaceId: String(wid), ...payload });
}

export function notifyUser(userId, event, payload = {}) {
  io()?.to(`user:${userId}`).emit(event, payload);
}

/** Immediately cuts a removed member off from a workspace's live updates. */
export function dropFromRoom(userId, wid) {
  io()?.in(`user:${userId}`).socketsLeave(`ws:${wid}`);
  notifyUser(userId, 'membership', { workspaceId: String(wid) });
}

/** Records an audit entry, then pushes the change to every connected member. */
export async function logAndBroadcast({ wid, user, action, entity, entityId, summary }) {
  await ActivityLog.create({
    workspace: wid,
    user: user._id,
    userName: user.name,
    action,
    entity,
    entityId,
    summary,
  });
  broadcast(wid, { entity, action, summary, by: String(user._id), byName: user.name });
}

/** Short-lived signed ticket that proves who the browser is when it opens a socket. */
export function socketTicket(userId) {
  const body = Buffer.from(JSON.stringify({ uid: String(userId), exp: Date.now() + 5 * 60_000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
