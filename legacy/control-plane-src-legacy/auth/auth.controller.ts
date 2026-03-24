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
import { Roles } from '../common/rbac/roles.decorator.js';
import { RolesGuard } from '../common/rbac/roles.guard.js';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password: string;

  @IsString()
  @IsNotEmpty()
  tenantId: string;

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

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: Response) {
    const ip = typeof req.headers['x-forwarded-for'] === 'string'
      ? req.headers['x-forwarded-for'].split(',')[0]?.trim()
      : req.ip;
    const userAgent = req.headers['user-agent'];
    
    const result = await this.auth.login({
      email: dto.email,
      password: dto.password,
      tenantId: dto.tenantId,
      totpCode: dto.totpCode,
    });

    // Set JWT cookie
    res.cookie('access_token', result.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    return { 
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      operator: result.operator,
      routing: result.routing
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('access_token');
    return { success: true };
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: any) {
    return {
      user: {
        id: req.user.sub,
        email: req.user.email,
        role: req.user.role,
        tenantId: req.user.tenantId,
      }
    };
  }

  @Get('mfa/status')
  @UseGuards(AuthGuard('jwt'))
  getMfaStatus(@Req() req: any) {
    return this.auth.verifyMfa(req.user.sub, '');
  }

  @Post('mfa/setup')
  @UseGuards(AuthGuard('jwt'))
  @Roles('platform_admin', 'tenant_admin')
  async setupMfa(@Req() req: any) {
    return this.auth.enableMfa(req.user.sub);
  }

  @Post('mfa/verify')
  @UseGuards(AuthGuard('jwt'))
  async verifyMfa(@Req() req: any, @Body() body: TotpDto) {
    return this.auth.verifyMfa(req.user.sub, body.code);
  }

  @Post('refresh')
  async refreshToken(@Body() body: { refresh_token: string }) {
    return this.auth.refreshToken(body.refresh_token);
  }
}
