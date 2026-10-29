'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  getMe,
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
} from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import type { AuthUser, LoginInput, RegisterInput } from '@/lib/api/types';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

/** Waits before re-checking the session after a network/server error (not after a 401). */
const SESSION_RETRY_DELAYS_MS = [1000, 2000, 4000];

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);

  // Load the session once. A 401/403 (after the client's single refresh attempt) means signed out.
  // A network error or 5xx is NOT a sign-out (the API may be restarting): retry a few times first,
  // so a short outage never bounces a signed-in admin or customer to the login page.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function load(attempt: number) {
      getMe()
        .then((profile) => {
          if (cancelled) return;
          setUser({ id: profile.id, name: profile.name, email: profile.email, role: profile.role });
          setStatus('authenticated');
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const signedOut = err instanceof ApiError && (err.status === 401 || err.status === 403);
          if (!signedOut && attempt < SESSION_RETRY_DELAYS_MS.length) {
            timer = setTimeout(() => load(attempt + 1), SESSION_RETRY_DELAYS_MS[attempt]);
            return;
          }
          setUser(null);
          setStatus('unauthenticated');
        });
    }

    load(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const signedIn = await apiLogin(input);
    setUser(signedIn);
    setStatus('authenticated');
    return signedIn;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const created = await apiRegister(input);
    setUser(created);
    setStatus('authenticated');
    return created;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      // Never leave a stale signed-in UI, even if the API call failed.
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
