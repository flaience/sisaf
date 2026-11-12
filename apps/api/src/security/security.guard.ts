import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

import { z } from 'zod';

import { SecurityContextResolverService } from
  './security-context-resolver.service';

import type { SecurityContext } from
  './security-context';

export interface AuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  securityContext?: SecurityContext;
}

@Injectable()
export class SecurityGuard implements CanActivate {
  constructor(
    private readonly resolver: SecurityContextResolverService,
  ) {}

  async canActivate(
    executionContext: ExecutionContext,
  ): Promise<boolean> {
    const request = executionContext
      .switchToHttp()
      .getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (
      typeof authorization !== 'string' ||
      !/^Bearer [^\s]+$/.test(authorization)
    ) {
      throw new UnauthorizedException(
        'Bearer token obrigatorio',
      );
    }

    const tenantHeader = request.headers['x-tenant-id'];

    const parsedTenant = z.uuid().safeParse(tenantHeader);

    if (!parsedTenant.success) {
      throw new BadRequestException(
        'X-Tenant-Id invalido ou ausente',
      );
    }

    const token = authorization.slice(7);

    request.securityContext = await this.resolver.resolve(
      token,
      parsedTenant.data,
    );

    return true;
  }
}
