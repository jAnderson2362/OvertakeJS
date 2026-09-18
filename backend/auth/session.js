// Session handling: a signed JWT in an httpOnly cookie.
//
// The token only carries the user id. Routes that need the user's profile
// look it up; everything else just needs `req.auth.userId`.

import jwt from 'jsonwebtoken';

const COOKIE = 'overtake_session';
const MAX_AGE_S = 30 * 24 * 60 * 60; // 30 days
const PROD = process.env.NODE_ENV === 'production';

function secret() {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (PROD) throw new Error('JWT_SECRET must be set in production.');
  return 'overtakejs-dev-secret-change-me';
}

export function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id }, secret(), { expiresIn: MAX_AGE_S });
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

/** Attach `req.auth = { userId }` when a valid session cookie is present. */
export function authenticate(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      const { sub } = jwt.verify(token, secret());
      req.auth = { userId: sub };
    } catch {
      clearSession(res); // expired or tampered: drop it quietly
    }
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.auth) return res.status(401).json({ error: 'Sign in to do that.' });
  next();
}
