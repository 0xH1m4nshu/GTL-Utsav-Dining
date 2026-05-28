import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../config/api';

const normalizeUserPayload = (payload) => {
  if (!payload) return null;
  if (typeof payload === 'string') {
    return { id: payload, displayName: payload };
  }
  const id = payload.user_id ?? payload.id ?? payload.email ?? '';
  const displayName =
    payload.displayName ?? payload.name ?? payload.user_id ?? payload.email ?? payload.id ?? '';
  return { ...payload, id, displayName };
};

export const getUserDisplayName = (user) => {
  if (!user) return '';
  if (typeof user === 'string') return user;
  return user.displayName ?? user.name ?? user.user_id ?? user.email ?? user.id ?? '';
};

export const createUserModel = (payload) => normalizeUserPayload(payload);

const UserContext = createContext({ user: null, setUser: () => {} });

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const raw = window.localStorage.getItem('gtl_user');
      return raw ? normalizeUserPayload(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  });
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchUser = async () => {
      try {
        // If Google OAuth redirected back with a user_id in the URL,
        // seed the user context from that so the navbar can show the
        // logged-in user even if cookies are restricted.
        const url = new URL(window.location.href);
        const userIdFromUrl = url.searchParams.get('user_id');
        if (userIdFromUrl && mounted) {
          setUser(normalizeUserPayload(userIdFromUrl));
        }

        const res = await fetch(`${API_BASE}/home`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('no user');
        const body = await res.json();
        const normalized = normalizeUserPayload(body?.data?.user);
        // Only overwrite the current user if the backend returned
        // a meaningful user object/string.
        if (mounted && normalized) {
          setUser(normalized);
        }
      } catch (error) {
        // keep user null
      } finally {
        if (mounted) setInitializing(false);
      }
    };
    fetchUser();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    try {
      if (user) {
        window.localStorage.setItem('gtl_user', JSON.stringify(user));
      } else {
        window.localStorage.removeItem('gtl_user');
      }
    } catch {
      // ignore storage failures (private mode, quota, etc.)
    }
  }, [user]);
  const value = useMemo(() => ({ user, setUser }), [user]);

  if (initializing) return null;
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => useContext(UserContext);
