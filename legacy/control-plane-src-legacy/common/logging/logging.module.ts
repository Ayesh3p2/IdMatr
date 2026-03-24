import { Module, Global } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { LoggingMiddleware } from './logging.middleware';

@Global()
@Module({
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggingModule {
  configure(consumer: any) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
