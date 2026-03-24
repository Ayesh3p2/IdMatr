import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RequestUser } from '../common/request-user.interface';
import { AuthenticatedUserService } from './authenticated-user.service';
import { extractAccessToken } from './auth-token.util';
import { JwtPayload } from './jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authenticatedUserService: AuthenticatedUserService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([extractAccessToken]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'dev-secret',
      passReqToCallback: true,
    });
  }

  async validate(request: { user?: RequestUser }, payload: JwtPayload): Promise<RequestUser> {
    return request.user ?? this.authenticatedUserService.validateAccessPayload(payload);
  }
}
