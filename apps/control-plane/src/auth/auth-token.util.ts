export function extractAccessToken(request: {
  headers?: { authorization?: string; cookie?: string };
}) {
  const authorization = request.headers?.authorization;
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice(7);
  }

  const cookieHeader = request.headers?.cookie;
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';').reduce<Record<string, string>>((acc, entry) => {
    const [rawName, ...rawValue] = entry.trim().split('=');
    if (!rawName || rawValue.length === 0) {
      return acc;
    }

    acc[rawName] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});

  return cookies.access_token ?? null;
}
