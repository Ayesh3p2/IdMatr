import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { UsersModule } from '../users/users.module';
import { IamController } from './iam.controller';

@Module({
  imports: [UsersModule, IntegrationsModule],
  controllers: [IamController],
})
export class IamModule {}
