import { wsRoute, readJson, ApiError } from '@/lib/api';
import { assertRefs, resources, titleOf } from '@/lib/crud';
import { logAndBroadcast } from '@/lib/realtime';

const cfgFor = (name) => {
  if (!Object.hasOwn(resources, name)) throw new ApiError(404, 'Not found.');
  return resources[name];
};

export const GET = wsRoute('read', async ({ params, wid }) => {
  const cfg = cfgFor(params.resource);
  if (cfg.list) return cfg.list(wid);
  let query = cfg.model.find({ workspace: wid }).sort(cfg.sort);
  if (cfg.populate) query = query.populate(cfg.populate, 'name color icon');
  return query.lean();
});

export const POST = wsRoute('add', async ({ req, user, params, wid }) => {
  const cfg = cfgFor(params.resource);
  const data = cfg.schema.parse(await readJson(req));
  await assertRefs(wid, data);
  const doc = await cfg.model.create({ ...data, workspace: wid, createdBy: user._id });
  await logAndBroadcast({ wid, user, action: 'added', entity: cfg.label, entityId: doc._id, summary: `${user.name} added ${cfg.label} ${titleOf(cfg, doc)}` });
  return doc;
});
