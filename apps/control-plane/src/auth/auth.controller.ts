import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthService } from './auth.service.js';
import {
  CONTROL_PLANE_COOKIE_NAME,
  buildClearedCookie,
  buildSessionCookie,
} from '../security/cookies.js';
import { Roles } from '../security/roles.decorator.js';
import { ControlPlaneRolesGuard } from '../security/roles.guard.js';
import { PLATFORM_OPERATOR_ROLE } from '../security/roles.js';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  totpCode?: string;
}

class TotpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  code: string;
}

@Controller('control/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const ip = typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : req.ip;
    const userAgent = req.headers['user-agent'];
    const result = await this.auth.login(dto.email, dto.password, dto.totpCode, ip, userAgent);
    res.setHeader('Set-Cookie', buildSessionCookie(CONTROL_PLANE_COOKIE_NAME, result.access_token, 60 * 60 * 12));
    return { operator: result.operator };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const ip = typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : req.ip;
    const userAgent = req.headers['user-agent'];
    await this.auth.logout(req.user.sub, ip, userAgent);
    res.setHeader('Set-Cookie', buildClearedCookie(CONTROL_PLANE_COOKIE_NAME));
    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: any) {
    return this.auth.getMe(req.user.sub);
  }

  @Get('mfa/status')
  @UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
  @Roles(PLATFORM_OPERATOR_ROLE)
  getMfaStatus(@Req() req: any) {
    return this.auth.getOperatorMfaStatus(req.user.sub);
  }

  @Post('mfa/setup')
  @UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
  @Roles(PLATFORM_OPERATOR_ROLE)
  setupMfa(@Req() req: any) {
    return this.auth.createOperatorMfaSetup(req.user.sub);
  }

  @Post('mfa/enable')
  @UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
  @Roles(PLATFORM_OPERATOR_ROLE)
  enableMfa(@Req() req: any, @Body() body: TotpDto) {
    return this.auth.enableOperatorMfa(req.user.sub, body.code);
  }

  @Post('mfa/disable')
  @UseGuards(AuthGuard('jwt'), ControlPlaneRolesGuard)
  @Roles(PLATFORM_OPERATOR_ROLE)
  disableMfa(@Req() req: any, @Body() body: TotpDto) {
    return this.auth.disableOperatorMfa(req.user.sub, body.code);
  }
}
