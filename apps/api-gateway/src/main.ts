import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Validate required environment variables on startup
  const required = ['JWT_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.enableShutdownHooks();

  // Global validation — strip unknown fields, transform types
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
  });

  // Security headers via custom middleware
  app.use((_req: any, res: any, next: any) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Body size limit
  app.use(require('express').json({ limit: '1mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '1mb' }));

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  Logger.log(`API Gateway running on port ${port}`, 'Bootstrap');
  Logger.log(`CORS origins: ${allowedOrigins.join(', ')}`, 'Bootstrap');
}
bootstrap();
