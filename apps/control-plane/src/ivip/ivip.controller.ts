import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/request-user.interface';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CreateRequestDto } from './dto/create-request.dto';
import { RequestDecisionDto } from './dto/request-decision.dto';
import { IvipService } from './ivip.service';

@Controller('ivip/requests')
@UseGuards(JwtAuthGuard)
export class IvipController {
  constructor(private readonly ivipService: IvipService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.ivipService.list(user);
  }

  @Post()
  create(@Body() dto: CreateRequestDto, @CurrentUser() user: RequestUser) {
    return this.ivipService.create(dto, user);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.TENANT_ADMIN)
  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: RequestDecisionDto, @CurrentUser() user: RequestUser) {
    return this.ivipService.approve(id, user, dto.notes);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PLATFORM_ADMIN, Role.TENANT_ADMIN)
  @Post(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RequestDecisionDto, @CurrentUser() user: RequestUser) {
    return this.ivipService.reject(id, user, dto.notes);
  }
}
