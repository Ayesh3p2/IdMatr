import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { EventSeverity, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/request-user.interface';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CreateEventDto } from './dto/create-event.dto';
import { ItdrService } from './itdr.service';

@Controller('itdr')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.TENANT_ADMIN)
export class ItdrController {
  constructor(private readonly itdrService: ItdrService) {}

  @Get('events')
  list(@CurrentUser() user: RequestUser, @Query('severity') severity?: EventSeverity) {
    return this.itdrService.list(user, severity);
  }

  @Post('events')
  create(@Body() dto: CreateEventDto, @CurrentUser() user: RequestUser) {
    return this.itdrService.create(dto, user);
  }

  @Post('detect/google')
  detectGoogle(@CurrentUser() user: RequestUser, @Body('integrationId') integrationId?: string) {
    return this.itdrService.detectGoogleSignals(user, integrationId);
  }
}
