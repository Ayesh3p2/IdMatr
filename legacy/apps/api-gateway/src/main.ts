import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { apiGatewayRateLimitMiddleware } from './rate-limit';

async function bootstrap() {
  const required = ['JWT_SECRET', 'INTERNAL_API_SECRET', 'NATS_URL', 'NATS_USER', 'NATS_PASSWORD', 'REDIS_URL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableShutdownHooks();
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean)
      || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    maxAge: 86400,
  });

  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: process.env.NODE_ENV === 'production',
  }));
  app.use(compression());

  const rateTtl = parseInt(process.env.RATE_LIMIT_TTL || '60') * 1000;
  const rateMax = parseInt(process.env.RATE_LIMIT_MAX || '100');
  const trustProxy = process.env.TRUST_PROXY === 'true';
  app.use(apiGatewayRateLimitMiddleware({
    ttlMs: rateTtl,
    maxRequests: rateMax,
    trustProxy,
  }));

  app.use(require('express').json({ limit: '1mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '1mb' }));

  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    app.use((_req: any, res: any, next: any) => {
      res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
      next();
    });
  }

  const enableSwagger = process.env.ENABLE_SWAGGER === 'true';
  if (!isProd || enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('IDMatr API')
      .setDescription('Identity Security Platform API Documentation')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('identities', 'Identity management endpoints')
      .addTag('applications', 'Application discovery endpoints')
      .addTag('risk', 'Risk scoring and analysis')
      .addTag('audit', 'Audit logging endpoints')
      .addTag('settings', 'Platform settings')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'IDMatr API Docs',
    });
  }

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`API Gateway running on port ${port}`, 'Bootstrap');
  logger.log(`CORS origins: ${process.env.ALLOWED_ORIGINS || 'http://localhost:3000'}`, 'Bootstrap');
  logger.log(`Rate limit: ${rateMax} req / ${rateTtl / 1000}s per IP`, 'Bootstrap');
  if (!isProd || enableSwagger) {
    logger.log(`API Documentation: http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}
bootstrap();
