import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import { TokenVerifierService } from './token-verifier.service';
import { AuthorizationService } from './authorization.service';

import type { SecurityContext } from './security-context';

@Injectable()
export class SecurityContextResolverService {
  constructor(
    private readonly tokenVerifier: TokenVerifierService,
    private readonly authorization: AuthorizationService,
  ) {}

  async resolve(
    token: string,
    requestedTenantId: string,
  ): Promise<SecurityContext> {
    const payload = await this.tokenVerifier.verify(token);

    if (
      typeof payload.iss !== 'string' ||
      !payload.iss ||
      typeof payload.sub !== 'string' ||
      !payload.sub
    ) {
      throw new UnauthorizedException(
        'Identidade do token invalida',
      );
    }

    return this.authorization.resolve({
      identity: {
        issuer: payload.iss,
        subject: payload.sub,
      },
      tenantId: requestedTenantId,
    });
  }
}
