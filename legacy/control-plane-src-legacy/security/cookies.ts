const ONE_DAY_SECONDS = 60 * 60 * 24;

function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...valueParts] = part.trim().split('=');
    if (rawName === name) {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

export const CONTROL_PLANE_COOKIE_NAME = 'idmatr_cp_session';

export function getCookie(req: { headers?: Record<string, string | string[] | undefined> }, name: string) {
  const header = req.headers?.cookie;
  return parseCookieValue(Array.isArray(header) ? header.join(';') : header, name);
}

export function buildSessionCookie(name: string, token: string, maxAgeSeconds = ONE_DAY_SECONDS / 2) {
  const isSecure = process.env.NODE_ENV === 'production';
  return [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    isSecure ? 'Secure' : '',
    `Max-Age=${maxAgeSeconds}`,
  ].filter(Boolean).join('; ');
}

export function buildClearedCookie(name: string) {
  const isSecure = process.env.NODE_ENV === 'production';
  return [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    isSecure ? 'Secure' : '',
    'Max-Age=0',
  ].filter(Boolean).join('; ');
}
