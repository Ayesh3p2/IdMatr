import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/request-user.interface';
import { IntegrationsService } from '../integrations/integrations.service';
import { MapIdentityDto } from '../integrations/dto/map-identity.dto';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { UsersService } from '../users/users.service';

@Controller('iam')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.TENANT_ADMIN)
export class IamController {
  constructor(
    private readonly usersService: UsersService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  @Get('users')
  listUsers(@CurrentUser() user: RequestUser, @Query('tenantId') tenantId?: string) {
    return this.usersService.findAll(user, tenantId);
  }

  @Post('users')
  createUser(@Body() dto: CreateUserDto, @CurrentUser() user: RequestUser) {
    return this.usersService.create(dto, user);
  }

  @Get('users/:id')
  getUser(@Param('id') id: string, @CurrentUser() user: RequestUser, @Query('tenantId') tenantId?: string) {
    return this.usersService.findOne(id, user, tenantId);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: RequestUser,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.usersService.update(id, dto, user, tenantId);
  }

  @Delete('users/:id')
  removeUser(@Param('id') id: string, @CurrentUser() user: RequestUser, @Query('tenantId') tenantId?: string) {
    return this.usersService.remove(id, user, tenantId);
  }

  @Get('identities')
  listIdentities(@CurrentUser() user: RequestUser, @Query('integrationId') integrationId?: string) {
    return this.integrationsService.listIdentities(user, integrationId);
  }

  @Post('identities/:id/map-local-user')
  mapIdentity(
    @Param('id') id: string,
    @Body() dto: MapIdentityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.integrationsService.mapIdentity(user, id, dto);
  }
}
