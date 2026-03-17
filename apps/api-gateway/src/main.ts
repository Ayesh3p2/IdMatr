import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { apiGatewayRateLimitMiddleware } from './rate-limit';

async function bootstrap() {
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

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean)
    || ['http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  });

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
  Logger.log(`API Gateway running on port ${port}`, 'Bootstrap');
  Logger.log(`CORS origins: ${allowedOrigins.join(', ')}`, 'Bootstrap');
  Logger.log(`Rate limit: ${rateMax} req / ${rateTtl / 1000}s per IP`, 'Bootstrap');
  if (!isProd || enableSwagger) {
    Logger.log(`API Documentation: http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}
bootstrap();
