import { Logger } from '@nestjs/common';

export const createLogger = (context: string) => {
  return new Logger(context);
};

export const auditLog = (logger: Logger, action: string, details: any) => {
  logger.log(`AUDIT [${action}]: ${JSON.stringify(details)}`);
};
