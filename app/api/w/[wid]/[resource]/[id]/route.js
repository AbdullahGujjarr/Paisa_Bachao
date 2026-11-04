import { wsRoute, readJson, assertId, ApiError } from '@/lib/api';
import { assertRefs, clearReferences, resources, titleOf } from '@/lib/crud';
import { logAndBroadcast } from '@/lib/realtime';

async function load(params, wid) {
  if (!Object.hasOwn(resources, params.resource)) throw new ApiError(404, 'Not found.');
  const cfg = resources[params.resource];
  const doc = await cfg.model.findOne({ _id: assertId(params.id), workspace: wid });
  if (!doc) throw new ApiError(404, `That ${cfg.label} was not found.`);
  return { cfg, doc };
}

export const PATCH = wsRoute('edit', async ({ req, user, params, wid }) => {
  const { cfg, doc } = await load(params, wid);
  // Merging first means a partial update still passes through full validation.
  const data = cfg.schema.parse({ ...JSON.parse(JSON.stringify(doc)), ...(await readJson(req)) });
  await assertRefs(wid, data);
  Object.assign(doc, cfg.beforeUpdate ? cfg.beforeUpdate(data) : data);
  await doc.save();
  await logAndBroadcast({ wid, user, action: 'edited', entity: cfg.label, entityId: doc._id, summary: `${user.name} updated ${cfg.label} ${titleOf(cfg, doc)}` });
  return doc;
});

export const DELETE = wsRoute('delete', async ({ user, params, wid }) => {
  const { cfg, doc } = await load(params, wid);
  await clearReferences(cfg, wid, doc._id);
  await doc.deleteOne();
  await logAndBroadcast({ wid, user, action: 'deleted', entity: cfg.label, entityId: doc._id, summary: `${user.name} deleted ${cfg.label} ${titleOf(cfg, doc)}` });
  return { ok: true };
});
