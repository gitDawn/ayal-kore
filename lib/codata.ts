import { CodataClient, ApiError, browserLocalStorage, cookieStorage } from 'codata-io';
import type { Interceptor } from 'codata-io';

// CODATA_GATE_URL must be set (the SDK has no default).
// Auth also runs in the browser, so expose NEXT_PUBLIC_CODATA_GATE_URL
// (same value; the gate URL is public — never expose the API key).
// NOTE: the API key is not needed for AUTH — but server-side managed-asset
// calls (e.g. notifications.send) DO require CODATA_API_KEY in the server env.
const gateUrl = (process.env.NEXT_PUBLIC_CODATA_GATE_URL || process.env.CODATA_GATE_URL)!;
// The app these calls come from: the Codata gate records it, so Metrics can filter by app.
const appHeader: Interceptor = {
  onRequest: (config) => (config.url.startsWith(gateUrl) ? { ...config, headers: { ...config.headers, 'x-codata-app': "haayal-kore-web" } } : config),
};
const client = new CodataClient({
  apiKey: process.env.CODATA_API_KEY!,
  gateUrl,
  interceptors: [appHeader],
});

// Sign-in session: a first-party COOKIE (so server-rendered pages load data
// AS the signed-in person — see lib/data.ts), mirrored to localStorage.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
function appSessionStorage() {
  const cookie = cookieStorage({ maxAgeSeconds: SESSION_MAX_AGE_SECONDS });
  const local = browserLocalStorage();
  return {
    get: async (key: string) => {
      const fromCookie = await cookie.get(key);
      if (fromCookie) return fromCookie;
      const fromLocal = await local.get(key);
      if (fromLocal) await cookie.set(key, fromLocal);
      return fromLocal;
    },
    set: async (key: string, value: string) => { await cookie.set(key, value); await local.set(key, value); },
    remove: async (key: string) => { await cookie.remove(key); await local.remove(key); },
  };
}

const ws = client.workspace('6aeefb60c2b84e46e6286801', {
  branch: "main",
  // Codata status widget: development builds only (a production build drops the token), browser only, read-only token. Remove to opt out.
  statusWidget: process.env.NODE_ENV === "development" ? { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0eXBlIjoic3RhdHVzLXdpZGdldCIsIndvcmtzcGFjZUlkIjoiNmE3MmYwYjZlOTU0N2U3YzdjYzkyOWNiIiwiYnJhbmNoTmFtZSI6Im1haW4iLCJpYXQiOjE3OTQwNDU0ODIsImV4cCI6MTc5NjYzNzQ4Mn0.2tgqt7vvinZUxZkWT1jV_jO5EXi946ivHEKN1q7bj-E", scriptUrl: "https://mcp.codata.io/api/widget/v1.js" } : null,
  auth: { storage: appSessionStorage() },
});

const NO_PERMISSION_MESSAGE = "You don't have permission to change this.";
const RAW_REFUSAL = /row-level security|violates|\bpolicy\b|permission denied|resource not found|^(?:forbidden|not found)\.?$|\b[1-5]\d\d\b|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b/i;
/** A 403's message in plain words (a status such as "403 Forbidden" is not words). */
function plainRefusalMessage(message: unknown): string {
  const s = typeof message === 'string' ? message.trim() : '';
  return s && s.length <= 200 && !RAW_REFUSAL.test(s) ? s : NO_PERMISSION_MESSAGE;
}
/**
 * Convert a Codata SDK error into an HTTP response payload that preserves
 * the upstream status.
 */
export function toHttpResponse(error: unknown): {
  status: number;
  body: { error: string; message: string; details?: unknown };
} {
  if (error instanceof ApiError) {
    const status = error.status >= 500 ? 502 : error.status;
    const details = (error.body && typeof error.body === 'object' && !Array.isArray(error.body))
      ? error.body
      : undefined;
    const c = (details as { code?: string } | undefined)?.code;
    if (error.status === 401 && (c === 'AUTH_REQUIRED' || c === 'SIGN_IN_TO_ATTACH')) return { status, body: { error: 'AUTH_REQUIRED', message: error.message, details } };
    return {
      status,
      body: {
        error: error.name,
        message: error.status === 403 ? plainRefusalMessage(error.message) : error.message,
        ...(details !== undefined ? { details } : {}),
      },
    };
  }
  return {
    status: 500,
    body: { error: 'InternalError', message: error instanceof Error ? error.message : 'Unexpected error' },
  };
}

// ── Caller identity (COD-1358 / COD-1367) ─────────────────────────
// `ws` carries the WORKSPACE API KEY: the OPERATOR. NEVER use it to serve a
// request on behalf of an end user. `callerWorkspace()` is built from the
// caller's own token.
const stripBearer = (credential: string) => credential.replace(/^Bearer\s+/i, '');

export function callerWorkspace(credential: string) {
  const callerClient = new CodataClient({
    apiKey: stripBearer(credential),
    gateUrl,
    interceptors: [appHeader],
  });
  return callerClient.workspace('6aeefb60c2b84e46e6286801', { branch: "main" });
}

export { client, ws };

// ── Auth helper (thin re-export of ws.auth — codata-io ≥0.13.0) ─────────
import type { AuthSession as _SdkAuthSession, AuthUser as _SdkAuthUser } from 'codata-io';
export interface AuthUser extends _SdkAuthUser {}
export interface AuthSession extends _SdkAuthSession {}

if (!ws.auth) {
  throw new Error(
    "lib/codata.ts: ws.auth is missing — the SDK was constructed without { auth } options. " +
    "Reinstall codata-io@^0.13.0 and regenerate the workspace integration kit."
  );
}
const _auth = ws.auth;

export const auth = {
  signUp(input: { email: string; password: string }) {
    return _auth.signUp(input);
  },
  signIn(input: { email: string; password: string }) {
    return _auth.signIn(input);
  },
  signOut() {
    return _auth.signOut();
  },
  me() {
    return _auth.me();
  },
  refresh() {
    return _auth.refresh();
  },
  requestPasswordReset(input: { email: string }) {
    return _auth.requestPasswordReset(input);
  },
  resetPassword(input: { recoveryToken: string; newPassword: string }) {
    return _auth.resetPassword(input);
  },
  getSession() { return _auth.getSession(); },
  setSession(session: AuthSession | null) { return _auth.setSession(session); },
  getAccessToken() { return _auth.getAccessToken(); },
  getAuthHeaders() { return _auth.getAuthHeaders(); },
  hydrate() { return _auth.hydrate(); },
  onAuthStateChange(listener: Parameters<typeof _auth.onAuthStateChange>[0]) {
    return _auth.onAuthStateChange(listener);
  },
  describeError(err: unknown) { return _auth.describeError(err); },
  getAuthErrorMessage(err: unknown): string {
    return _auth.describeError(err).message;
  },
  isEmailNotVerifiedError(err: unknown): boolean {
    return _auth.isEmailNotVerifiedError(err);
  },
};
