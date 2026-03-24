import { Injectable, Module, OnModuleInit } from '@nestjs/common';
import { PrivacyController } from './privacy.controller.js';
import { InternalPrivacyController } from './internal-privacy.controller.js';
import { PrivacyService } from './privacy.service.js';
import { SecurityModule } from '../security/security.module.js';

@Injectable()
class PrivacyBootstrap implements OnModuleInit {
  constructor(private readonly privacy: PrivacyService) {}

  onModuleInit() {
    this.privacy.startRetentionScheduler();
  }
}

@Module({
  imports: [SecurityModule],
  controllers: [PrivacyController, InternalPrivacyController],
  providers: [PrivacyService, PrivacyBootstrap],
  exports: [PrivacyService],
})
export class PrivacyModule {}
