// Sign in or create an account. `?next=` says where to go afterwards.
import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../auth.jsx';
import { PrimaryButton } from '../components/ui.jsx';

const MODES = [
  { value: 'login', label: 'Sign in' },
  { value: 'register', label: 'Create account' },
];

function Field({ label, hint, ...props }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between text-[11px] uppercase tracking-wider text-ink/50 mb-1.5">
        {label}
        {hint && <span className="normal-case tracking-normal text-ink/35">{hint}</span>}
      </span>
      <input
        {...props}
        className="w-full rounded-lg border border-line/40 bg-bg-deep/70 px-3 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-highlight/70 focus:ring-2 focus:ring-highlight/20 transition-colors"
      />
    </label>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const { login, register } = useAuth();

  const [mode, setMode] = useState(params.get('mode') === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const registering = mode === 'register';

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (registering) await register(email, password, name);
      else await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <Link to="/" className="font-display text-4xl leading-none tracking-tight">
            Overtake<span className="text-highlight">JS</span>
          </Link>
          <p className="text-sm text-ink/55 mt-2">
            {registering ? 'Pick a driver name and start collecting.' : 'Welcome back to the paddock.'}
          </p>
        </div>

        <div className="rounded-2xl border border-line/35 bg-surface/60 backdrop-blur-md shadow-2xl shadow-bg-deep/60 p-6">
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-line/40 bg-bg-deep/70 p-0.5 mb-6" role="tablist">
            {MODES.map((m) => {
              const active = m.value === mode;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setMode(m.value); setError(null); }}
                  className={`relative flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
                >
                  {active && (
                    <motion.span
                      layoutId="auth-mode"
                      className="absolute inset-0 rounded-md bg-line/50"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10">{m.label}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <AnimatePresence initial={false}>
              {registering && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <Field
                    label="Driver name"
                    hint="2 to 24 characters"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="What the leaderboard calls you"
                    autoComplete="nickname"
                    minLength={2}
                    maxLength={24}
                    required
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <Field
              label="Password"
              hint={registering ? 'At least 8 characters' : undefined}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={registering ? 'Something you will remember' : 'Your password'}
              autoComplete={registering ? 'new-password' : 'current-password'}
              minLength={registering ? 8 : undefined}
              required
            />

            <AnimatePresence>
              {error && (
                <motion.p
                  key="err"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-ink"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <PrimaryButton type="submit" disabled={busy} className="w-full mt-2 text-xl!">
              {busy ? 'One moment' : registering ? 'Create account' : 'Sign in'}
            </PrimaryButton>

            <button
              type="button"
              disabled={busy}
              onClick={() => window.location.href = 'http://localhost:5000/api/auth/google'}
              className="w-full mt-2 flex items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-gray-700 font-[Lato] font-medium shadow-sm border border-gray-300 hover:bg-gray-100 hover:shadow-md transition-all"
            >
              <img src="https://developers.google.com/identity/images/g-logo.png" alt="" className="w-5 h-5" />
              Continue with Google
            </button>



          </form>
        </div>

        <p className="text-center text-xs text-ink/40 mt-5">
          <Link to="/" className="hover:text-ink transition-colors">Back to race setup</Link>
        </p>
      </motion.div>
    </div>
  );
}
