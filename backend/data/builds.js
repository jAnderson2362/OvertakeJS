// Build repository. MongoDB when connected, otherwise an in-memory map so the
// garage still works without a database (builds just reset on restart).

import { randomUUID } from 'node:crypto';
import Build from '../models/Build.js';
import { isDbReady } from './store.js';

const memory = new Map(); // id -> build

const isObjectId = (id) => /^[0-9a-f]{24}$/.test(id);

// Parts come back as stored; cards/builds.js normalizeParts maps them onto
// the current slots.
function fromDoc(doc) {
  return {
    id: String(doc._id),
    userId: doc.userId,
    name: doc.name,
    carCardId: doc.carCardId,
    parts: doc.parts ?? {},
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/** A user's builds, oldest first. */
export async function listBuilds(userId) {
  if (!isDbReady()) {
    return [...memory.values()].filter((b) => b.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
  }
  const docs = await Build.find({ userId }).sort({ createdAt: 1 }).lean();
  return docs.map(fromDoc);
}

export async function createBuild(userId, { name, carCardId, parts }) {
  if (!isDbReady()) {
    const now = new Date();
    const b = { id: randomUUID(), userId, name, carCardId, parts, createdAt: now, updatedAt: now };
    memory.set(b.id, b);
    return { ...b };
  }
  return fromDoc(await Build.create({ userId, name, carCardId, parts }));
}

/** Update one of the user's builds. Returns null if it isn't theirs or doesn't exist. */
export async function updateBuild(userId, id, { name, carCardId, parts }) {
  if (!isDbReady()) {
    const b = memory.get(id);
    if (!b || b.userId !== userId) return null;
    Object.assign(b, { name, carCardId, parts, updatedAt: new Date() });
    return { ...b };
  }
  if (!isObjectId(id)) return null;
  const doc = await Build.findOneAndUpdate(
    { _id: id, userId },
    { $set: { name, carCardId, parts } },
    { returnDocument: 'after', lean: true },
  );
  return doc ? fromDoc(doc) : null;
}

/** Delete one of the user's builds. Returns true if something was removed. */
export async function deleteBuild(userId, id) {
  if (!isDbReady()) {
    const b = memory.get(id);
    if (!b || b.userId !== userId) return false;
    return memory.delete(id);
  }
  if (!isObjectId(id)) return false;
  const res = await Build.deleteOne({ _id: id, userId });
  return res.deletedCount === 1;
}
