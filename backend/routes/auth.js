import { Router } from 'express';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { createUser, findUserByEmail, findUserById, normalizeEmail, findOrCreateByGoogle, bumpSessionVersion } from '../data/users.js';
import { issueSession, clearSession, requireAuth } from '../auth/session.js';

const router = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BCRYPT_ROUNDS = 10;
const PROD = process.env.NODE_ENV === 'production';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI
  || `http://localhost:${process.env.PORT || 5000}/api/auth/google/callback`;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Slows password guessing and account spam: 20 attempts per IP per 15 minutes.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

router.post('/register', authLimiter, async (req, res) => {
  const { email, password, name } = req.body ?? {};
  const e = normalizeEmail(email);
  const n = String(name ?? '').trim();

  if (!EMAIL.test(e)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (n.length < 2 || n.length > 24) return res.status(400).json({ error: 'Driver name must be 2 to 24 characters.' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }
  // bcrypt ignores everything past 72 bytes.
  if (Buffer.byteLength(password) > 72) {
    return res.status(400).json({ error: 'Password must be at most 72 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await createUser({ email: e, name: n, passwordHash });
    await issueSession(res, user);
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === 'EMAIL_TAKEN') return res.status(409).json({ error: 'An account with that email already exists.' });
    console.error('Register failed:', err);
    res.status(500).json({ error: 'Could not create the account.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body ?? {};
  try {
    const record = await findUserByEmail(email);
    // Same response for unknown email, Google-only account and wrong password.
    const ok = record?.passwordHash && typeof password === 'string'
      && (await bcrypt.compare(password, record.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' });

    const user = { id: record.id, email: record.email, name: record.name };
    await issueSession(res, user);
    res.json({ user });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Could not sign in.' });
  }
});

// Signs out on every device: any copy of the cookie, stolen or not, stops working.
router.post('/logout', async (req, res) => {
  try {
    if (req.auth) await bumpSessionVersion(req.auth.userId);
  } catch (err) {
    console.error('Session revoke failed:', err.message);
  }
  clearSession(res);
  res.json({ ok: true });
});

// Current session. Returns { user: null } rather than 401 so the client can
// render a signed-out state without treating it as an error.
router.get('/me', async (req, res) => {
  if (!req.auth) return res.json({ user: null });
  try {
    const user = await findUserById(req.auth.userId);
    if (!user) clearSession(res);
    res.json({ user });
  } catch (err) {
    console.error('Session lookup failed:', err);
    res.status(500).json({ error: 'Could not load your session.' });
  }
});

const STATE_COOKIE = { httpOnly: true, sameSite: 'lax', secure: PROD, path: '/api/auth/google' };

router.get('/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(404).json({ error: 'Google sign-in is not configured.' });
  }
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { ...STATE_COOKIE, maxAge: 600000 });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'email profile',
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', authLimiter, async (req, res) => {
  try {
    const { code, state } = req.query;
    const expected = req.cookies?.oauth_state;
    res.clearCookie('oauth_state', STATE_COOKIE);

    // Both must be present: a missing state would otherwise equal a missing
    // cookie and let another site sign the browser into its own account.
    if (typeof state !== 'string' || typeof code !== 'string' || !expected || state !== expected) {
      return res.status(403).send('Invalid state');
    }

    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    // The token came straight from Google over TLS, so its signature doesn't
    // need checking, but it must be issued for this app and the email must be
    // verified before it is trusted to link to an existing account.
    const payload = JSON.parse(
      Buffer.from(data.id_token.split('.')[1], 'base64url').toString()
    );
    const validIssuer = ['https://accounts.google.com', 'accounts.google.com'].includes(payload.iss);
    if (!validIssuer || payload.aud !== GOOGLE_CLIENT_ID || payload.email_verified !== true || !payload.sub) {
      return res.status(403).send('Google account could not be verified');
    }

    const user = await findOrCreateByGoogle({
      googleId: payload.sub,
      email: payload.email,
      name: String(payload.name ?? payload.email.split('@')[0]).slice(0, 24),
    });

    await issueSession(res, user);
    res.redirect(CLIENT_URL);
  } catch (err) {
    // Log the message only: axios errors carry the request body, which
    // includes the client secret.
    console.error('Google OAuth failed:', err.message);
    res.status(500).send('OAuth failed');
  }
});

export { requireAuth };
export default router;
