// User repository. MongoDB when connected, otherwise an in-memory map so
// sign-up and sign-in still work in dev without a database (accounts are
// lost on restart in that mode).

import { randomUUID } from 'node:crypto';
import User from '../models/User.js';
import { isDbReady } from './store.js';

const memory = new Map(); // id -> { id, email, name, passwordHash, googleId, sessionVersion }

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
    const u = { id: randomUUID(), email: e, name, passwordHash, sessionVersion: 0 };
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

/** Current session version, or null if the user no longer exists. */
export async function getSessionVersion(id) {
  if (!isDbReady()) return memory.get(id)?.sessionVersion ?? null;
  if (!/^[0-9a-f]{24}$/.test(id)) return null;
  const doc = await User.findById(id, { sessionVersion: 1 }).lean();
  return doc ? (doc.sessionVersion ?? 0) : null;
}

/** Invalidate every session this user has, on every device. */
export async function bumpSessionVersion(id) {
  if (!isDbReady()) {
    const u = memory.get(id);
    if (u) u.sessionVersion += 1;
    return;
  }
  await User.updateOne({ _id: id }, { $inc: { sessionVersion: 1 } });
}

export async function findOrCreateByGoogle({ googleId, email, name }) {
    const e = normalizeEmail(email);

    // Linking Google to an existing email account proves who owns the email.
    // Sign-ups never verified it, so whoever set the password may be an
    // impostor: drop the password and end every existing session.
    if (!isDbReady()) {
      // Check by googleId first
      let u = [...memory.values()].find((v) => v.googleId === googleId);
      if (u) return publicUser(u);
      // Check by email (link accounts)
      u = [...memory.values()].find((v) => v.email === e);
      if (u) {
        Object.assign(u, { googleId, passwordHash: null, sessionVersion: u.sessionVersion + 1 });
        return publicUser(u);
      }
      // Create new
      u = { id: randomUUID(), email: e, name, googleId, passwordHash: null, sessionVersion: 0 };
      memory.set(u.id, u);
      return publicUser(u);
    }

    // Check by googleId first
    let doc = await User.findOne({ googleId }).lean();
    if (doc) return publicUser(fromDoc(doc));
    // Check by email (link accounts)
    doc = await User.findOneAndUpdate(
      { email: e },
      { $set: { googleId }, $unset: { passwordHash: 1 }, $inc: { sessionVersion: 1 } },
      { returnDocument: 'after' },
    ).lean();
    if (doc) return publicUser(fromDoc(doc));
    // Create new
    doc = await User.create({ email: e, name, googleId });
    return publicUser(fromDoc(doc));
  }
