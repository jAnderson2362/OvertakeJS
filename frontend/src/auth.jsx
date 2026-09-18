// Auth state for the whole app. `user` is undefined while the session is
// being checked, null when signed out, otherwise { id, email, name }.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    api.fetchMe()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: u } = await api.login(email, password);
    setUser(u);
    return u;
  }, []);

  const register = useCallback(async (email, password, name) => {
    const { user: u } = await api.register(email, password, name);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try { await api.logout(); } finally { setUser(null); }
  }, []);

  const value = useMemo(
    () => ({ user, loading: user === undefined, login, register, logout }),
    [user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
