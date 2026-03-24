import * as net from 'net';

type RateLimitOptions = {
  ttlMs?: number;
  maxRequests?: number;
  trustProxy?: boolean;
};

type RedisConnection = {
  host: string;
  port: number;
  password?: string;
  username?: string;
  db?: number;
};

function parseRedisUrl(): RedisConnection {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL env var is required');
  }

  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    username: parsed.username || undefined,
    db: parsed.pathname && parsed.pathname !== '/' ? Number(parsed.pathname.slice(1)) : undefined,
  };
}

function buildCommand(args: (string | number)[]) {
  return `*${args.length}\r\n${args.map((arg) => {
    const value = String(arg);
    return `$${Buffer.byteLength(value)}\r\n${value}\r\n`;
  }).join('')}`;
}

function parseReplies(buffer: string) {
  const replies: any[] = [];
  let cursor = 0;

  while (cursor < buffer.length) {
    const type = buffer[cursor];
    const lineEnd = buffer.indexOf('\r\n', cursor);
    if (lineEnd === -1) break;
    const payload = buffer.slice(cursor + 1, lineEnd);

    if (type === '+' || type === ':') {
      replies.push(type === ':' ? Number(payload) : payload);
      cursor = lineEnd + 2;
      continue;
    }

    if (type === '-') {
      throw new Error(payload);
    }

    if (type === '$') {
      const size = Number(payload);
      if (size === -1) {
        replies.push(null);
        cursor = lineEnd + 2;
        continue;
      }
      const start = lineEnd + 2;
      const end = start + size;
      replies.push(buffer.slice(start, end));
      cursor = end + 2;
      continue;
    }

    break;
  }

  return replies;
}

async function redisIncrement(key: string, ttlSeconds: number) {
  const connection = parseRedisUrl();
  const commands: (string | number)[][] = [];

  if (connection.password) {
    commands.push(connection.username
      ? ['AUTH', connection.username, connection.password]
      : ['AUTH', connection.password]);
  }
  if (typeof connection.db === 'number' && !Number.isNaN(connection.db)) {
    commands.push(['SELECT', connection.db]);
  }
  commands.push(['INCR', key]);
  commands.push(['EXPIRE', key, ttlSeconds, 'NX']);

  const payload = commands.map(buildCommand).join('');

  return new Promise<number>((resolve, reject) => {
    const socket = net.createConnection({ host: connection.host, port: connection.port }, () => {
      socket.write(payload);
    });

    let raw = '';
    socket.setTimeout(2000);

    socket.on('data', (chunk) => {
      raw += chunk.toString('utf8');
      try {
        const replies = parseReplies(raw);
        if (replies.length >= commands.length) {
          socket.end();
          const incrReply = replies[commands.length - 2];
          resolve(Number(incrReply));
        }
      } catch (error) {
        socket.destroy();
        reject(error);
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('Redis rate limit timeout'));
    });

    socket.on('error', (error) => reject(error));
  });
}

export function apiGatewayRateLimitMiddleware(options: RateLimitOptions = {}) {
  const ttlMs = options.ttlMs ?? 60_000;
  const maxRequests = options.maxRequests ?? 100;
  const trustProxy = options.trustProxy ?? false;

  return async (req: any, res: any, next: any) => {
    // Skip rate limiting for health checks, metrics, and auth endpoints
    if (req.path.includes('/health') || req.path.includes('/metrics') || req.path.includes('/control/auth')) {
      return next();
    }

    const isAuthPath = req.path.startsWith('/api/auth');
    const effectiveTtlMs = isAuthPath ? 15 * 60 * 1000 : ttlMs;
    const effectiveMaxRequests = isAuthPath ? 10 : maxRequests;
    const ip = trustProxy
      ? (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip
      : req.ip;
    const key = `ratelimit:${isAuthPath ? 'auth' : 'default'}:${ip}`;

    try {
      const count = await redisIncrement(key, Math.ceil(effectiveTtlMs / 1000));
      res.setHeader('X-RateLimit-Limit', effectiveMaxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, effectiveMaxRequests - count));
      if (count > effectiveMaxRequests) {
        res.status(429).json({ statusCode: 429, message: 'Too Many Requests' });
        return;
      }
      next();
    } catch (error) {
      res.status(503).json({ statusCode: 503, message: 'Rate limiting backend unavailable' });
    }
  };
}
