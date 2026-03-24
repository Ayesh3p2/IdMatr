import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/request-user.interface';
import { Roles } from '../rbac/roles.decorator';
import { RolesGuard } from '../rbac/roles.guard';
import { CreateAccessReviewDto } from './dto/create-access-review.dto';
import { ReviewDecisionDto } from './dto/review-decision.dto';
import { IgaService } from './iga.service';

@Controller('iga/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PLATFORM_ADMIN, Role.TENANT_ADMIN)
export class IgaController {
  constructor(private readonly igaService: IgaService) {}

  @Get()
  list(@CurrentUser() user: RequestUser) {
    return this.igaService.list(user);
  }

  @Post()
  create(@Body() dto: CreateAccessReviewDto, @CurrentUser() user: RequestUser) {
    return this.igaService.create(dto, user);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ReviewDecisionDto, @CurrentUser() user: RequestUser) {
    return this.igaService.approve(id, user, dto.notes);
  }

  @Post(':id/revoke')
  revoke(@Param('id') id: string, @Body() dto: ReviewDecisionDto, @CurrentUser() user: RequestUser) {
    return this.igaService.revoke(id, user, dto.notes);
  }
}
