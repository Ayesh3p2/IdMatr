import { Module, Global } from '@nestjs/common';
import { EmailService } from './email.service.js';

@Global()  // make EmailService available everywhere without explicit imports
@Module({
  providers: [EmailService],
  exports:   [EmailService],
})
export class EmailModule {}
