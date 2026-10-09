import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export const ROLE_LABEL = { student: 'طالبة', teacher: 'معلمة', supervisor: 'مشرفة', admin: 'إدارة عامة' };
export const ROLE_HOME = { student: '/student', teacher: '/teacher', supervisor: '/manage', admin: '/manage' };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [boot, setBoot] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [ready, setReady] = useState(!getToken());

  const loadBootstrap = useCallback(async () => {
    if (!getToken()) { setLoading(false); setReady(true); return; }
    try {
      const data = await api.get('common/bootstrap', { silent: true });
      setUser(data.user);
      setBoot(data);
    } catch (e) {
      setToken(''); setUser(null);
    } finally { setLoading(false); setReady(true); }
  }, []);

  useEffect(() => { loadBootstrap(); }, [loadBootstrap]);
  useEffect(() => {
    const onOut = () => { setUser(null); setBoot(null); };
    window.addEventListener('kan:unauthorized', onOut);
    return () => window.removeEventListener('kan:unauthorized', onOut);
  }, []);

  const login = useCallback(async (username, password) => {
    const data = await api.post('auth/login', { username, password });
    setToken(data.token);
    setUser(data.user);
    await loadBootstrap();
    return data.user;
  }, [loadBootstrap]);

  const logout = useCallback(async () => {
    try { await api.post('auth/logout', {}, { silent: true }); } catch (e) { /* ignore */ }
    setToken(''); setUser(null); setBoot(null);
  }, []);

  const value = useMemo(() => ({
    user, boot, loading, ready, login, logout, refresh: loadBootstrap,
    role: user ? user.role : null,
    settings: (boot && boot.settings) || (user && user.settings) || null,
    meta: (boot && boot.meta) || null,
    unreadMessages: (boot && boot.unread_messages) || 0,
    unreadNotifications: (boot && boot.unread_notifications) || 0
  }), [user, boot, loading, ready, login, logout, loadBootstrap]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
