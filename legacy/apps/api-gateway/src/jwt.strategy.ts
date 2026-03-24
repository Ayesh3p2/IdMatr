import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AUTH_COOKIE_NAME, parseCookie } from './security';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET env var is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => parseCookie(req, AUTH_COOKIE_NAME),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  async validate(payload: any) {
    if (!payload) {
      throw new UnauthorizedException();
    }
    return {
      userId: payload.sub,
      email: payload.email,
      name: payload.name,
      roles: payload.roles,
      tenantId: payload.tenantId || null,
      forcePasswordChange: payload.forcePasswordChange || false,
      userType: payload.userType || 'system_admin',
    };
  }
}
