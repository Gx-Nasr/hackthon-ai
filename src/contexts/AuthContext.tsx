import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService, type Credentials, type Registration } from '../services/authService';
import type { User } from '../types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  signIn: (credentials: Credentials) => Promise<User>;
  signUp: (data: Registration) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try { setUser(await authService.currentUser()); } catch { setUser(null); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  const signIn = useCallback(async (credentials: Credentials) => { const next = await authService.login(credentials); setUser(next); return next; }, []);
  const signUp = useCallback(async (data: Registration) => { const next = await authService.signup(data); setUser(next); return next; }, []);
  const signOut = useCallback(async () => { try { await authService.logout(); } finally { setUser(null); } }, []);
  const value = useMemo(() => ({ user, loading, signIn, signUp, signOut, refresh }), [user, loading, signIn, signUp, signOut, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
