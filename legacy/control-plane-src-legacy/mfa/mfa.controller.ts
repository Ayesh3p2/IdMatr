import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MfaService } from './mfa.service';
import { GenerateMfaDto } from './dto/generate-mfa.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/guards/roles.guard';

@Controller('mfa')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('generate')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  generate(@Body() generateMfaDto: GenerateMfaDto, @Req() req: any) {
    return this.mfaService.generateSecret(req.user.id, generateMfaDto);
  }

  @Post('verify')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  verify(@Body() verifyMfaDto: VerifyMfaDto, @Req() req: any) {
    return this.mfaService.verifyAndEnable(req.user.id, verifyMfaDto);
  }

  @Post('disable')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  disable(@Body() body: { password: string }, @Req() req: any) {
    return this.mfaService.disable(req.user.id, body.password);
  }

  @Get('status')
  getStatus(@Req() req: any) {
    return this.mfaService.getMfaStatus(req.user.id);
  }
}
