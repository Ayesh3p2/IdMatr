import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/request-user.interface';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { IspmService } from './ispm.service';

@Controller('ispm/apps')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.TENANT_ADMIN)
export class IspmController {
  constructor(private readonly ispmService: IspmService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.ispmService.list(user);
  }

  @Get(':integrationId')
  getOne(@CurrentUser() user: RequestUser, @Param('integrationId') integrationId: string) {
    return this.ispmService.getOne(user, integrationId);
  }
}
