import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AccessReviewService } from './access-review.service.js';
import { Roles } from '../security/roles.decorator.js';
import { ControlPlaneRolesGuard } from '../security/roles.guard.js';
import { PLATFORM_OPERATOR_ROLE } from '../security/roles.js';
import {
  CONTROL_PLANE_COOKIE_NAME,
  buildSessionCookie,
} from '../security/cookies.js';

class StartReviewDto {
  @IsOptional()
  @IsString()
  dueAt?: string;
}

class ReviewItemDto {
  @IsIn(['approved', 'revoke', 'pending'])
  disposition: string;

  @IsOptional()
  @IsString()
  @MaxLength(400)
  notes?: string;
}

class BreakGlassRequestDto {
  @IsEmail()
  operatorEmail: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  justification: string;
}

class BreakGlassConsumeDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}

@Controller('control/access-reviews')
export class AccessReviewController {
  constructor(private readonly accessReviews: AccessReviewService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
  @Roles(PLATFORM_OPERATOR_ROLE)
  startReview(@Body() dto: StartReviewDto, @Req() req: any) {
    return this.accessReviews.startReview(req.user.sub, dto.dueAt);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
  @Roles(PLATFORM_OPERATOR_ROLE)
  listReviews() {
    return this.accessReviews.listReviews();
  }

  @Patch(':reviewId/items/:itemId')
  @UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
  @Roles(PLATFORM_OPERATOR_ROLE)
  reviewItem(
    @Param('reviewId') reviewId: string,
    @Param('itemId') itemId: string,
    @Body() dto: ReviewItemDto,
    @Req() req: any,
  ) {
    return this.accessReviews.reviewItem(reviewId, itemId, dto.disposition, dto.notes, req.user.sub);
  }

  @Post(':reviewId/finalize')
  @UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
  @Roles(PLATFORM_OPERATOR_ROLE)
  finalizeReview(@Param('reviewId') reviewId: string, @Req() req: any) {
    return this.accessReviews.finalizeReview(reviewId, req.user.sub);
  }

  @Post('break-glass')
  @UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
  @Roles(PLATFORM_OPERATOR_ROLE)
  createBreakGlass(@Body() dto: BreakGlassRequestDto, @Req() req: any) {
    return this.accessReviews.createBreakGlass(req.user.sub, dto.operatorEmail, dto.justification);
  }

  @Post('break-glass/consume')
  async consumeBreakGlass(
    @Body() dto: BreakGlassConsumeDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : req.ip;
    const userAgent = req.headers['user-agent'];
    const result = await this.accessReviews.consumeBreakGlassToken(dto.token, ip, userAgent);
    res.setHeader('Set-Cookie', buildSessionCookie(CONTROL_PLANE_COOKIE_NAME, result.access_token, 60 * 60));
    return { operator: result.operator };
  }
}
