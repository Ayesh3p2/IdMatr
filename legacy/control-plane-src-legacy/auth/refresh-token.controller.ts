import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { JwtService } from './jwt.service';
import { CurrentUser } from '../common/tenant/tenant.decorator';

@Controller('auth')
export class RefreshTokenController {
  constructor(private readonly jwtService: JwtService) {}

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() body: { refreshToken: string },
    @CurrentUser() user: { id: string }
  ) {
    return this.jwtService.refreshTokens(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() body: { refreshToken: string },
    @CurrentUser() user: { id: string }
  ) {
    await this.jwtService.revokeRefreshToken(body.refreshToken);
    await this.jwtService.revokeAllUserTokens(user.id);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: { id: string }) {
    await this.jwtService.revokeAllUserTokens(user.id);
    return { message: 'Logged out from all devices successfully' };
  }
}
