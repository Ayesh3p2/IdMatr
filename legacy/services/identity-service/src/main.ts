import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  if (!process.env.NATS_URL || !process.env.NATS_USER || !process.env.NATS_PASSWORD) {
    throw new Error('NATS_URL, NATS_USER, and NATS_PASSWORD env vars are required');
  }
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.NATS,
    options: {
      servers: [process.env.NATS_URL],
      user: process.env.NATS_USER,
      pass: process.env.NATS_PASSWORD,
    },
  });
  
  await app.startAllMicroservices();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Identity service listening on port ${port}`);
}
bootstrap();
