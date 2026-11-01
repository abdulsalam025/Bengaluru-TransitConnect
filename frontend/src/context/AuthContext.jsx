import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getStoredToken, setStoredToken, transitApi } from '../api/transitApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(Boolean(getStoredToken()));

  const refreshProfile = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setAuthLoading(false);
      return null;
    }
    try {
      const profile = await transitApi.getMe();
      setUser(profile);
      return profile;
    } catch {
      setStoredToken(null);
      setUser(null);
      return null;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const login = useCallback(async (email, password) => {
    const res = await transitApi.login({ email, password });
    setStoredToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await transitApi.register(payload);
    setStoredToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
  }, []);

  const isAdmin = useMemo(
    () => Boolean(user?.roles?.includes('ROLE_ADMIN')),
    [user]
  );

  const value = useMemo(
    () => ({
      user,
      setUser,
      authLoading,
      isAdmin,
      login,
      register,
      logout,
      refreshProfile
    }),
    [user, authLoading, isAdmin, login, register, logout, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}