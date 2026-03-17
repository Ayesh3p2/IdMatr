import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { apiGatewayRateLimitMiddleware } from './rate-limit';

async function bootstrap() {
  // Validate required environment variables on startup
  const required = ['JWT_SECRET', 'INTERNAL_API_SECRET', 'NATS_URL', 'NATS_USER', 'NATS_PASSWORD', 'REDIS_URL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }));

  // CORS — restrict to configured origins
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean)
    || ['http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  });

  // Rate limiting — 100 req/min per IP by default
  const rateTtl = parseInt(process.env.RATE_LIMIT_TTL || '60') * 1000;
  const rateMax = parseInt(process.env.RATE_LIMIT_MAX || '100');
  const trustProxy = process.env.TRUST_PROXY === 'true';
  app.use(apiGatewayRateLimitMiddleware({
    ttlMs: rateTtl,
    maxRequests: rateMax,
    trustProxy,
  }));

  // Body size limit (parse BEFORE security headers so express is fully init)
  app.use(require('express').json({ limit: '1mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '1mb' }));

  // Security headers
  const isProd = process.env.NODE_ENV === 'production';
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; frame-ancestors 'none'",
    );
    if (isProd) {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    next();
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`API Gateway running on port ${port}`, 'Bootstrap');
  Logger.log(`CORS origins: ${allowedOrigins.join(', ')}`, 'Bootstrap');
  Logger.log(`Rate limit: ${rateMax} req / ${rateTtl / 1000}s per IP`, 'Bootstrap');
}
bootstrap();
