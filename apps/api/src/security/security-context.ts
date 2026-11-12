export type ActorType = 'user' | 'service';

export type Permission =
  | 'people:read'
  | 'people:create'
  | 'people:update'
  | 'people:share'
  | 'people:delete';

export interface SecurityContext {
  actor: {
    id: string;
    type: ActorType;
  };

  tenantId: string;

  scope: {
    companyIds: string[];
    branchIds: string[];
  };

  permissions: readonly Permission[];
}

export function hasPermission(
  context: SecurityContext,
  permission: Permission,
): boolean {
  return context.permissions.includes(permission);
}
