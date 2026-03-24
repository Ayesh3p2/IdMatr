import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/request-user.interface';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CreateInviteDto } from './dto/create-invite.dto';
import { InvitesService } from './invites.service';

@Controller('invites')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.TENANT_ADMIN)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  create(@Body() dto: CreateInviteDto, @CurrentUser() user: RequestUser) {
    return this.invitesService.create(dto, user);
  }

  @Get()
  list(@CurrentUser() user: RequestUser, @Query('tenantId') tenantId?: string) {
    return this.invitesService.list(user, tenantId);
  }

  @Patch(':id/revoke')
  revoke(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.invitesService.revoke(id, user);
  }
}
