import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/guards/roles.guard';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  findAll(
    @Query('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.usersService.findAll(
      tenantId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
      search,
    );
  }

  @Get(':id')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return this.usersService.findOne(id, tenantId);
  }

  @Patch(':id')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Query('tenantId') tenantId: string,
  ) {
    return this.usersService.update(id, updateUserDto, tenantId);
  }

  @Delete(':id')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return this.usersService.remove(id, tenantId);
  }

  @Post(':id/activate')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  activate(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return this.usersService.activate(id, tenantId);
  }

  @Post(':id/deactivate')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  deactivate(@Param('id', ParseUUIDPipe) id: string, @Query('tenantId') tenantId: string) {
    return this.usersService.deactivate(id, tenantId);
  }

  @Post(':id/reset-password')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { newPassword: string },
    @Query('tenantId') tenantId: string,
  ) {
    return this.usersService.resetPassword(id, tenantId, body.newPassword);
  }

  @Get('stats/:tenantId')
  @Roles('PLATFORM_ADMIN', 'TENANT_ADMIN')
  getStats(@Param('tenantId') tenantId: string) {
    return this.usersService.getUserStats(tenantId);
  }
}
