import 'reflect-metadata';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { AuthService } from './auth/auth.service.js';
import { controlPlaneRateLimit } from './security/rate-limit.js';
import { MetricsService } from './metrics/metrics.service.js';

async function bootstrap() {
  const required = [
    'CONTROL_PLANE_JWT_SECRET',
    'INTERNAL_API_SECRET',
    'DATA_ENCRYPTION_KEY',
    'CONTROL_PLANE_DATABASE_URL',
    'REDIS_URL',
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const logger = new Logger('ControlPlane');
  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
    exclude: ['health', 'metrics'],
  });

  app.use(require('express').json({ limit: '1mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '1mb' }));
  app.use(controlPlaneRateLimit());
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  const metrics = app.get(MetricsService);
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route?.path || req.path;
      metrics.httpRequestDuration.observe(
        { method: req.method, route, status_code: res.statusCode },
        duration,
      );
      metrics.httpRequestTotal.inc({
        method: req.method,
        route,
        status_code: res.statusCode,
      });
    });
    next();
  });

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean)
    || ['http://localhost:3002', 'http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  try {
    const auth = app.get(AuthService);
    await auth.seedSuperAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn(`Could not seed platform operator: ${message}`);
  }

  const port = process.env.CONTROL_PLANE_PORT || 3010;
  await app.listen(port);
  logger.log(`IdMatr Control Plane running on port ${port}`);
  logger.log(`API v1 available at /v1/*`);
  logger.log(`Health check available at /health`);
  logger.log(`Metrics available at /metrics`);
}

bootstrap();
