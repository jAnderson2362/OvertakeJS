// User repository. MongoDB when connected, otherwise an in-memory map so
// sign-up and sign-in still work in dev without a database (accounts are
// lost on restart in that mode).

import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import { isDbReady } from './store.js';

const memory = new Map(); // id -> { id, email, name, passwordHash }

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name });

const fromDoc = (doc) =>
  doc && { id: String(doc._id), email: doc.email, name: doc.name, passwordHash: doc.passwordHash };

export const normalizeEmail = (email) => String(email ?? '').trim().toLowerCase();

/** Full record including the password hash; for credential checks only. */
export async function findUserByEmail(email) {
  const e = normalizeEmail(email);
  if (!isDbReady()) return [...memory.values()].find((u) => u.email === e) ?? null;
  return fromDoc(await User.findOne({ email: e }).lean());
}

export async function findUserById(id) {
  if (!isDbReady()) {
    const u = memory.get(id);
    return u ? publicUser(u) : null;
  }
  if (!/^[0-9a-f]{24}$/.test(id)) return null;
  const doc = await User.findById(id).lean();
  return doc ? publicUser(fromDoc(doc)) : null;
}

/** Create a user. Throws { code: 'EMAIL_TAKEN' } on a duplicate email. */
export async function createUser({ email, name, passwordHash }) {
  const e = normalizeEmail(email);
  if (!isDbReady()) {
    if ([...memory.values()].some((u) => u.email === e)) throw Object.assign(new Error('Email taken'), { code: 'EMAIL_TAKEN' });
    const u = { id: randomUUID(), email: e, name, passwordHash };
    memory.set(u.id, u);
    return publicUser(u);
  }
  try {
    const doc = await User.create({ email: e, name, passwordHash });
    return publicUser(fromDoc(doc));
  } catch (err) {
    if (err?.code === 11000) throw Object.assign(new Error('Email taken'), { code: 'EMAIL_TAKEN' });
    throw err;
  }
}
