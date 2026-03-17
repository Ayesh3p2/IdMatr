import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrivacyService } from './privacy.service.js';
import { Roles } from '../security/roles.decorator.js';
import { ControlPlaneRolesGuard } from '../security/roles.guard.js';
import { PLATFORM_OPERATOR_ROLE } from '../security/roles.js';
import {
  PublishPrivacyNoticeDto,
  TriggerRetentionScanDto,
} from '../tenants/dto/privacy.dto.js';

@Controller('control/privacy')
@UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
@Roles(PLATFORM_OPERATOR_ROLE)
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Post('notices')
  publishNotice(@Body() dto: PublishPrivacyNoticeDto, @Req() req: any, @Query('tenantId') tenantId?: string) {
    return this.privacy.publishNotice(tenantId || null, dto, req.user.sub);
  }

  @Get('notices/active')
  getActiveNotice(@Query('tenantId') tenantId?: string) {
    return this.privacy.getActiveNotice(tenantId || null);
  }

  @Get('requests')
  getRequests(@Query('tenantId') tenantId?: string) {
    return this.privacy.listRequests(tenantId);
  }

  @Post('retention/run')
  runRetention(@Body() dto: TriggerRetentionScanDto) {
    return this.privacy.runRetentionScan(dto.processImmediately ?? true);
  }

  @Get('retention/tasks')
  getRetentionTasks(@Query('tenantId') tenantId?: string) {
    return this.privacy.listRetentionTasks(tenantId);
  }
}
