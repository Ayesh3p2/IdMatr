import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { InvitesService } from './invites.service';
import { CreateInviteDto } from './dto/create-invite.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/guards/roles.guard';

@Controller('invites')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  create(@Body() createInviteDto: CreateInviteDto) {
    return this.invitesService.create(createInviteDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  findAll(@Param('tenantId') tenantId: string) {
    return this.invitesService.findAll(tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.invitesService.findOne(id);
  }

  @Post('accept/:token')
  accept(@Param('token') token: string, @Body() acceptInviteDto: AcceptInviteDto) {
    return this.invitesService.accept(token, acceptInviteDto);
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  revoke(@Param('id', ParseUUIDPipe) id: string) {
    return this.invitesService.revoke(id);
  }

  @Post(':id/resend')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  resend(@Param('id', ParseUUIDPipe) id: string) {
    return this.invitesService.resend(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.invitesService.remove(id);
  }

  @Post('cleanup-expired')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('PLATFORM_ADMIN')
  cleanupExpired() {
    return this.invitesService.cleanupExpired();
  }
}
