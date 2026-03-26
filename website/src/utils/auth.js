const SESSION_KEY = 'dm_session';
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const GOOGLE_REDIRECT_URI = import.meta.env.VITE_GOOGLE_REDIRECT_URI || '';
const GOOGLE_STATE_KEY = 'dm_google_state';
const GOOGLE_NONCE_KEY = 'dm_google_nonce';

const readJson = (storage, key, fallback) => {
  try {
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeJson = (storage, key, value) => {
  storage.setItem(key, JSON.stringify(value));
};

// MongoDB-based authentication - Register new user
export const registerUser = async ({ username, password }) => {
  if (!username || !password) {
    return { ok: false, message: 'Username and password are required' };
  }

  try {
    const response = await fetch(`${API_BASE}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      return { ok: true, user: data.user };
    }
    return { ok: false, message: data.message };
  } catch {
    return { ok: false, message: 'Network error. Ensure backend is running on http://localhost:5000' };
  }
};

export const getGoogleClientId = () => {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
};

export const getGoogleAuthorizeUrl = () => `${API_BASE}/api/google/authorize`;

const decodeJwtPayload = (token) => {
  try {
    const part = String(token || '').split('.')[1] || '';
    if (!part) return null;
    const normalized = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
};

const createRandomToken = () => {
  if (typeof window === 'undefined' || !window.crypto?.getRandomValues) {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
};

const getFrontendGoogleAuthorizeUrl = (clientId) => {
  if (typeof window === 'undefined') return '';

  const state = createRandomToken();
  const nonce = createRandomToken();
  sessionStorage.setItem(GOOGLE_STATE_KEY, state);
  sessionStorage.setItem(GOOGLE_NONCE_KEY, nonce);

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  const redirectUri = GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/google/callback`;
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'id_token');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('prompt', 'select_account');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);

  return authUrl.toString();
};

const checkBackendGoogleAuth = async () => {
  try {
    const response = await fetch(`${API_BASE}/api/google/config`);
    const data = await response.json();
    if (!data?.success) return { ok: false, authorizeUrl: '' };
    return { ok: true, authorizeUrl: data.authorizeUrl || getGoogleAuthorizeUrl() };
  } catch {
    return { ok: false, authorizeUrl: '' };
  }
};

const exchangeGoogleIdToken = async (idToken) => {
  try {
    const response = await fetch(`${API_BASE}/api/google/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken })
    });

    const data = await response.json();
    if (!data?.success || !data?.user) {
      return { ok: false, message: data?.message || 'Google login failed' };
    }

    return { ok: true, user: data.user };
  } catch {
    return { ok: false, message: 'Unable to reach backend for Google sign-in' };
  }
};

export const isGoogleAuthAvailable = async () => {
  const backend = await checkBackendGoogleAuth();
  return backend.ok || Boolean(getGoogleClientId());
};

export const startGoogleLogin = async () => {
  if (typeof window === 'undefined') return;

  const backend = await checkBackendGoogleAuth();
  if (backend.ok && backend.authorizeUrl) {
    window.location.assign(backend.authorizeUrl);
    return;
  }

  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error('Google client ID is not configured');
  }

  window.location.assign(getFrontendGoogleAuthorizeUrl(clientId));
};

// MongoDB-based authentication - Login
export const authenticateUser = async ({ username, password }) => {
  if (!username || !password) return null;

  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (data.success) {
      return data.user; // { username, role: 'admin' | 'user' }
    }
    return null;
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
};

export const parseGoogleAuthCallback = async (hashValue) => {
  const fragment = String(hashValue || '').startsWith('#') ? String(hashValue).slice(1) : String(hashValue || '');
  const params = new URLSearchParams(fragment);
  const error = params.get('error');

  if (error) {
    return { ok: false, message: error };
  }

  const username = params.get('username') || '';
  const token = params.get('token') || '';

  if (username && token) {
    return {
      ok: true,
      user: {
        id: params.get('id') || username,
        username,
        email: params.get('email') || '',
        name: params.get('name') || '',
        picture: params.get('picture') || '',
        googleId: params.get('googleId') || '',
        role: params.get('role') || 'user',
        token
      }
    };
  }

  const idToken = params.get('id_token') || '';
  if (!idToken) {
    return { ok: false, message: 'Google authentication response is incomplete' };
  }

  const expectedState = sessionStorage.getItem(GOOGLE_STATE_KEY) || '';
  const expectedNonce = sessionStorage.getItem(GOOGLE_NONCE_KEY) || '';
  sessionStorage.removeItem(GOOGLE_STATE_KEY);
  sessionStorage.removeItem(GOOGLE_NONCE_KEY);

  const returnedState = params.get('state') || '';
  if (expectedState && returnedState && expectedState !== returnedState) {
    return { ok: false, message: 'Google authentication state mismatch' };
  }

  const claims = decodeJwtPayload(idToken) || {};
  if (expectedNonce && claims.nonce && expectedNonce !== claims.nonce) {
    return { ok: false, message: 'Google authentication nonce mismatch' };
  }

  return exchangeGoogleIdToken(idToken);
};

// Set session (stores role-based session info)
export const setSession = (user, rememberMe = false) => {
  const storage = rememberMe ? localStorage : sessionStorage;
  const userId = user?.id || user?._id || user?.userId || user?.username;
  const session = {
    userId,
    username: user.username,
    email: user.email || '',
    name: user.name || '',
    picture: user.picture || '',
    googleId: user.googleId || '',
    role: user.role,
    token: user.token || null,
    loginTime: Date.now()
  };
  writeJson(storage, SESSION_KEY, session);
};

// Get current session
export const getSession = () => {
  return readJson(sessionStorage, SESSION_KEY, null) || readJson(localStorage, SESSION_KEY, null);
};

// Clear session
export const clearSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
};

// Check if user is admin
export const isAdminSession = () => {
  const session = getSession();
  return session?.role === 'admin';
};

// Check if user is logged in
export const isUserSession = () => {
  const session = getSession();
  return session?.role === 'user';
};

export const getSessionUserId = () => {
  const session = getSession();
  return session?.userId || session?.username || null;
};

// Check if any session exists
export const hasSession = () => {
  return getSession() !== null;
};
