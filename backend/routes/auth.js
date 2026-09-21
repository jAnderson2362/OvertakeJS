import { Router } from 'express';
import bcrypt from 'bcryptjs';
import axios from 'axios';
import crypto from 'node:crypto';
import { createUser, findUserByEmail, findUserById, normalizeEmail, findOrCreateByGoogle } from '../data/users.js';
import { claimPlayer } from '../data/players.js';
import { issueSession, clearSession, requireAuth } from '../auth/session.js';

const router = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ANON_ID = /^[A-Za-z0-9_-]{8,64}$/;
const BCRYPT_ROUNDS = 10;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = `http://localhost:${process.env.PORT || 5000}/api/auth/google/callback`;

/**
 * If the browser opened packs before signing in, it still sends its anonymous
 * player id. Move that collection onto the account when the account has none.
 */
async function adoptAnonymous(req, userId) {
  const anon = req.get('X-Player-Id');
  if (!anon || !ANON_ID.test(anon) || anon === userId) return;
  try {
    await claimPlayer(anon, userId);
  } catch (err) {
    console.error('Failed to claim anonymous collection:', err.message);
  }
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body ?? {};
  const e = normalizeEmail(email);
  const n = String(name ?? '').trim();

  if (!EMAIL.test(e)) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (n.length < 2 || n.length > 24) return res.status(400).json({ error: 'Driver name must be 2 to 24 characters.' });
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await createUser({ email: e, name: n, passwordHash });
    await adoptAnonymous(req, user.id);
    issueSession(res, user);
    res.status(201).json({ user });
  } catch (err) {
    if (err.code === 'EMAIL_TAKEN') return res.status(409).json({ error: 'An account with that email already exists.' });
    console.error('Register failed:', err);
    res.status(500).json({ error: 'Could not create the account.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  try {
    const record = await findUserByEmail(email);
    // Same response for unknown email and wrong password.
    const ok = record && typeof password === 'string' && (await bcrypt.compare(password, record.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Email or password is incorrect.' });

    const user = { id: record.id, email: record.email, name: record.name };
    await adoptAnonymous(req, user.id);
    issueSession(res, user);
    res.json({ user });
  } catch (err) {
    console.error('Login failed:', err);
    res.status(500).json({ error: 'Could not sign in.' });
  }
});

router.post('/logout', (req, res) => {
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

router.get('/google', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000 });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'email profile',
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (state !== req.cookies?.oauth_state) {
      return res.status(403).send('Invalid state');
    }
    res.clearCookie('oauth_state');

    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const payload = JSON.parse(
      Buffer.from(data.id_token.split('.')[1], 'base64').toString()
    );

    const user = await findOrCreateByGoogle({
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
    });

    await adoptAnonymous(req, user.id);
    issueSession(res, user);
    res.redirect('http://localhost:5173');
  } catch (err) {
    console.error('Google OAuth failed:', err);
    res.status(500).send('OAuth failed');
  }
});

export { requireAuth };
export default router;
