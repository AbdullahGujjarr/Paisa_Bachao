import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { ZodError } from 'zod';
import { auth } from './auth';
import { dbConnect } from './db';
import { can } from './workspace';
import { User, WorkspaceMember, Workspace } from '@/models';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const isId = (v) => typeof v === 'string' && mongoose.isObjectIdOrHexString(v);

export function assertId(v, label = 'id') {
  if (!isId(v)) throw new ApiError(400, `Invalid ${label}`);
  return v;
}

function checkOrigin(req) {
  if (['GET', 'HEAD'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (new URL(origin).host !== host) throw new ApiError(403, 'Cross-site request blocked');
}

function toResponse(result, status = 200) {
  if (result instanceof Response) return result;
  return NextResponse.json(result ?? { ok: true }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function toError(err) {
  if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ZodError) {
    const issue = err.issues[0];
    const field = issue?.path?.join('.');
    return NextResponse.json({ error: field ? `${field}: ${issue.message}` : issue?.message }, { status: 422 });
  }
  if (err?.code === 11000) return NextResponse.json({ error: 'That already exists.' }, { status: 409 });
  if (err?.name === 'ValidationError' || err?.name === 'CastError') {
    return NextResponse.json({ error: 'Invalid data.' }, { status: 422 });
  }
  console.error('[api]', err);
  return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}

export async function currentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  await dbConnect();
  const user = await User.findById(session.user.id);
  if (!user || user.sessionVersion !== session.sv) return null;
  return user;
}

/** Route wrapper for public endpoints: origin check, DB connection and error mapping. */
export function publicRoute(fn) {
  return async (req, ctx) => {
    try {
      checkOrigin(req);
      await dbConnect();
      return toResponse(await fn({ req, params: await ctx?.params }));
    } catch (err) {
      return toError(err);
    }
  };
}

/** Route wrapper that requires a signed-in user. */
export function route(fn) {
  return async (req, ctx) => {
    try {
      checkOrigin(req);
      const user = await currentUser();
      if (!user) throw new ApiError(401, 'Please sign in.');
      return toResponse(await fn({ req, user, params: await ctx?.params }));
    } catch (err) {
      return toError(err);
    }
  };
}

/**
 * Route wrapper for everything under /api/w/[wid]. Membership comes from the database for
 * every request, so a user cannot reach another workspace by changing the id in the URL.
 * A non-member gets 404 rather than 403, which avoids confirming that the workspace exists.
 */
export function wsRoute(perm, fn) {
  return route(async ({ req, user, params }) => {
    const wid = assertId(params.wid, 'workspace');
    const member = await WorkspaceMember.findOne({ workspace: wid, user: user._id });
    if (!member) throw new ApiError(404, 'Workspace not found.');
    const resolved = typeof perm === 'function' ? perm(req, params) : perm;
    if (!can(member, resolved)) throw new ApiError(403, 'You do not have permission to do that.');
    const workspace = await Workspace.findById(wid);
    if (!workspace) throw new ApiError(404, 'Workspace not found.');
    return fn({ req, user, params, member, workspace, wid });
  });
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    throw new ApiError(400, 'Invalid JSON body.');
  }
}
