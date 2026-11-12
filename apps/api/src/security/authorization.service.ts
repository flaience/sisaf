import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { DatabaseProvider } from '../database/database.provider';
import {
  identities,
  tenantMemberships,
  membershipPermissions,
  membershipUnits,
} from '../database/schema';

import type {
  AuthorizationRequest,
  AuthorizationResult,
} from './authorization.types';

import type {
  Permission,
} from './security-context';

const permissions = [
  'people:read',
  'people:create',
  'people:share',
  'people:update',
  'people:delete',
] as const satisfies readonly Permission[];

const permissionSchema = z.enum(permissions);

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly database: DatabaseProvider,
  ) {}

  async resolve(
    request: AuthorizationRequest,
  ): Promise<AuthorizationResult> {
    const db = this.database.db;

    if (!db) {
      throw new ServiceUnavailableException(
        'Banco de dados indisponivel',
      );
    }

    const tenantId = z.uuid().safeParse(
      request.tenantId,
    );

    if (!tenantId.success) {
      throw new ForbiddenException(
        'Acesso ao tenant negado',
      );
    }

    const [membership] = await db
      .select({
        identityId: identities.id,
        actorType: identities.actorType,
        membershipId: tenantMemberships.id,
      })
      .from(identities)
      .innerJoin(
        tenantMemberships,
        eq(
          tenantMemberships.identityId,
          identities.id,
        ),
      )
      .where(
        and(
          eq(identities.issuer, request.identity.issuer),
          eq(identities.subject, request.identity.subject),
          eq(identities.isActive, true),
          eq(tenantMemberships.tenantId, tenantId.data),
          eq(tenantMemberships.isActive, true),
        ),
      )
      .limit(1);

    if (
      !membership ||
      !['user', 'service'].includes(
        membership.actorType,
      )
    ) {
      throw new ForbiddenException(
        'Acesso ao tenant negado',
      );
    }

    const [grants, units] = await Promise.all([
      db
        .select({
          permission: membershipPermissions.permission,
        })
        .from(membershipPermissions)
        .where(
          and(
            eq(
              membershipPermissions.tenantId,
              tenantId.data,
            ),
            eq(
              membershipPermissions.membershipId,
              membership.membershipId,
            ),
          ),
        ),

      db
        .select({
          personId: membershipUnits.personId,
          unitType: membershipUnits.unitType,
        })
        .from(membershipUnits)
        .where(
          and(
            eq(
              membershipUnits.tenantId,
              tenantId.data,
            ),
            eq(
              membershipUnits.membershipId,
              membership.membershipId,
            ),
          ),
        ),
    ]);

    const effectivePermissions = grants
      .map((grant) =>
        permissionSchema.safeParse(grant.permission),
      )
      .filter((result) => result.success)
      .map((result) => result.data);

    return {
      actor: {
        id: membership.identityId,
        type: membership.actorType as 'user' | 'service',
      },
      tenantId: tenantId.data,
      permissions: effectivePermissions,
      scope: {
        companyIds: units
          .filter((unit) =>
            unit.unitType === 'headquarters',
          )
          .map((unit) => unit.personId),

        branchIds: units
          .filter((unit) =>
            unit.unitType === 'branch',
          )
          .map((unit) => unit.personId),
      },
    };
  }
}
