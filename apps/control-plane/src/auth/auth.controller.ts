import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentUser } from '../common/current-user.decorator';
import { RequestUser } from '../common/request-user.interface';
import { AcceptInviteDto } from '../invites/dto/accept-invite.dto';
import { AllowWithoutMfa } from './allow-without-mfa.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('google')
  async googleLogin(@Query('tenantSlug') tenantSlug: string, @Res() res: Response) {
    const { authorizationUrl } = await this.authService.getGoogleAuthorizationUrl(tenantSlug);
    return res.redirect(authorizationUrl);
  }

  @Public()
  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string | undefined,
    @Res() res: Response,
  ) {
    if (error) {
      throw new UnauthorizedException(`Google OAuth failed: ${error}`);
    }

    const result = await this.authService.completeGoogleAuthorization(code, state);

    const secure = process.env.NODE_ENV === 'production';
    res.cookie('access_token', result.tokens.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
    });
    res.cookie('refresh_token', result.tokens.refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
    });

    return res.redirect(result.onboardingUrl);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: RequestUser) {
    return this.authService.me(user);
  }

  @Public()
  @Get('invites/:token')
  getInvite(@Param('token') token: string) {
    return this.authService.getInvite(token);
  }

  @Public()
  @Post('invites/:token/accept')
  acceptInvite(@Param('token') token: string, @Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite({
      token,
      name: dto.name,
      password: dto.password,
    });
  }
}
