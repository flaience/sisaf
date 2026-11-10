import {
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';

import {
  createRemoteJWKSet,
  type JWTPayload,
} from 'jose';
import { validateJwt } from './jwt-validator';

import { getEnvironment } from '../config/env';

@Injectable()
export class TokenVerifierService {
  private readonly issuer?: string;
  private readonly audience?: string;
  private readonly jwks?: ReturnType<
    typeof createRemoteJWKSet
  >;

  constructor() {
    const env = getEnvironment();

    if (
      env.OIDC_ISSUER &&
      env.OIDC_AUDIENCE &&
      env.OIDC_JWKS_URI
    ) {
      this.issuer = env.OIDC_ISSUER;
      this.audience = env.OIDC_AUDIENCE;

      this.jwks = createRemoteJWKSet(
        new URL(env.OIDC_JWKS_URI),
      );
    }
  }

  async verify(token: string): Promise<JWTPayload> {
    if (
      !this.issuer ||
      !this.audience ||
      !this.jwks
    ) {
      throw new ServiceUnavailableException(
        'Autenticacao OIDC nao configurada',
      );
    }

    if (!token || token.length > 16384) {
      throw new UnauthorizedException(
        'Token invalido',
      );
    }

    try {
      const payload = await validateJwt(
        token,
        this.jwks,
        this.issuer,
        this.audience,
      );

      return payload;
    } catch {
      throw new UnauthorizedException(
        'Token invalido ou expirado',
      );
    }
  }
}
