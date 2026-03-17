import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CONTROL_PLANE_COOKIE_NAME, getCookie } from '../security/cookies.js';
import { normalizeOperatorRole } from '../security/roles.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    if (!process.env.CONTROL_PLANE_JWT_SECRET) {
      throw new Error('CONTROL_PLANE_JWT_SECRET env var is required');
    }
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: any) => getCookie(req, CONTROL_PLANE_COOKIE_NAME),
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.CONTROL_PLANE_JWT_SECRET,
    });
  }

  async validate(payload: any) {
    if (!payload.sub) throw new UnauthorizedException();
    return { sub: payload.sub, email: payload.email, role: normalizeOperatorRole(payload.role) };
  }
}
