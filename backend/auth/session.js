// Session handling: a signed JWT in an httpOnly cookie.
//
// The token carries the user id and the user's session version. Raising the
// version (logout, Google account link) invalidates every older token, so a
// stolen cookie can be shut off. Routes that need the user's profile look it
// up; everything else just needs `req.auth.userId`.

import jwt from 'jsonwebtoken';
import { getSessionVersion } from '../data/users.js';

const COOKIE = 'overtake_session';
const MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days
const PROD = process.env.NODE_ENV === 'production';

// No fallback: a known secret lets anyone forge a session for any user.
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a random string of at least 32 characters.');
}

export async function issueSession(res, user) {
  const v = await getSessionVersion(user.id);
  const token = jwt.sign({ sub: user.id, v }, SECRET, { expiresIn: MAX_AGE_S });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: PROD,
    maxAge: MAX_AGE_S * 1000,
    path: '/',
  });
}

export function clearSession(res) {
  res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'lax', secure: PROD, path: '/' });
}

/** Attach `req.auth = { userId }` when a valid, current session cookie is present. */
export async function authenticate(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();

  let payload;
  try {
    payload = jwt.verify(token, SECRET, { algorithms: ['HS256'] });
  } catch {
    clearSession(res); // expired or tampered: drop it quietly
    return next();
  }

  // Revoked (older version) or the account is gone.
  const current = await getSessionVersion(payload.sub);
  if (current === null || payload.v !== current) {
    clearSession(res);
    return next();
  }

  req.auth = { userId: payload.sub };
  next();
}

export function requireAuth(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: 'Sign in to do that.' });
  next();
}
