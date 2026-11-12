import { ForbiddenException } from '@nestjs/common';

import type {
  SecurityContext,
  Permission,
} from './security-context';

export type OperationalUnitType =
  | 'headquarters'
  | 'branch';

export interface OperationalUnit {
  id: string;
  type: OperationalUnitType;
}

export function requireUnitAccess(
  context: SecurityContext,
  permission: Permission,
  unit: OperationalUnit,
): void {
  if (!context.permissions.includes(permission)) {
    throw new ForbiddenException(
      'Permissao insuficiente',
    );
  }

  const allowedUnits =
    unit.type === 'headquarters'
      ? context.scope.companyIds
      : context.scope.branchIds;

  if (!allowedUnits.includes(unit.id)) {
    throw new ForbiddenException(
      'Acesso a unidade operacional negado',
    );
  }
}
