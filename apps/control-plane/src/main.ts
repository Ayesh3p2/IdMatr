import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const requestSizeLimit = process.env.REQUEST_SIZE_LIMIT ?? '1mb';
  const globalRateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const globalRateLimitMax = Number(process.env.RATE_LIMIT_MAX ?? 300);
  const authRateLimitWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 900_000);
  const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10);

  app.setGlobalPrefix('api');
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' },
      referrerPolicy: { policy: 'no-referrer' },
    }),
  );
  app.use(json({ limit: requestSizeLimit }));
  app.use(urlencoded({ extended: true, limit: requestSizeLimit }));
  app.use(
    rateLimit({
      windowMs: globalRateLimitWindowMs,
      limit: globalRateLimitMax,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (request) => request.path === '/api/health',
    }),
  );
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: authRateLimitWindowMs,
      limit: authRateLimitMax,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
  app.use(
    '/api/auth/refresh',
    rateLimit({
      windowMs: authRateLimitWindowMs,
      limit: authRateLimitMax,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  );
  app.enableCors({
    origin: buildCorsOriginValidator(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 86_400,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      stopAtFirstError: true,
    }),
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error) => {
  console.error('Failed to start IDMatr backend', error);
  process.exit(1);
});

function buildCorsOriginValidator() {
  const configuredOrigins = process.env.CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowedOrigins = new Set(
    configuredOrigins && configuredOrigins.length > 0
      ? configuredOrigins
      : process.env.NODE_ENV === 'production'
        ? []
        : [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3010',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:3001',
            'http://127.0.0.1:3010',
          ],
  );

  if (process.env.NODE_ENV === 'production' && allowedOrigins.size === 0) {
    throw new Error('CORS_ORIGIN must be configured in production');
  }

  return (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Origin not allowed by CORS'));
  };
}
