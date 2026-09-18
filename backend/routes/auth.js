import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { createUser, findUserByEmail, findUserById, normalizeEmail } from '../data/users.js';
import { claimPlayer } from '../data/players.js';
import { issueSession, clearSession, requireAuth } from '../auth/session.js';

const router = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ANON_ID = /^[A-Za-z0-9_-]{8,64}$/;
const BCRYPT_ROUNDS = 10;

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

export { requireAuth };
export default router;
