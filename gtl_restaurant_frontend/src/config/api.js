const resolveApiBase = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  if (typeof window === 'undefined') {
    return 'http://localhost:5001';
  }

  const { protocol, hostname, port, origin } = window.location;

  // When the SPA is already served by Flask on the backend port, use same-origin APIs.
  if (port === '5001') {
    return origin;
  }

  // For local development, normalize loopback hosts to localhost so the API
  // endpoint stays stable across browser/security quirks.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//localhost:5001`;
  }

  // When opened from another device on the LAN, keep the same host and use
  // backend port 5001.
  return `${protocol}//${hostname}:5001`;
};

export const API_BASE = resolveApiBase();

export const getStoredUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem('gtl_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const apiFetch = (url, options = {}) => {
  const user = getStoredUser();
  const headers = new Headers(options.headers || {});
  const userId = user?.user_id ?? user?.id ?? '';
  if (userId && !headers.has('X-User-Id')) {
    headers.set('X-User-Id', userId);
  }

  return fetch(url, {
    credentials: 'include',
    ...options,
    headers,
  });
};
