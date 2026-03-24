import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { AllowWithoutMfa } from '../auth/allow-without-mfa.decorator';
import { MfaSetupGuard } from '../auth/mfa-setup.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/request-user.interface';
import { VerifyTotpDto } from './dto/verify-totp.dto';
import { MfaService } from './mfa.service';

@Controller('mfa')
@UseGuards(MfaSetupGuard)
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Get('status')
  status(@CurrentUser() user: RequestUser) {
    return this.mfaService.status(user);
  }

  @AllowWithoutMfa()
  @Post('setup')
  setup(@CurrentUser() user: RequestUser) {
    return this.mfaService.setup(user);
  }

  @AllowWithoutMfa()
  @Post('verify')
  verify(@CurrentUser() user: RequestUser, @Body() dto: VerifyTotpDto) {
    return this.mfaService.verify(user, dto.code);
  }

  @Post('disable')
  disable(@CurrentUser() user: RequestUser, @Body() dto: VerifyTotpDto) {
    return this.mfaService.disable(user, dto.code);
  }
}
