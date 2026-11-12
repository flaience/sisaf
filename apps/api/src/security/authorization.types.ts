import type { SecurityContext } from './security-context';

export interface AuthenticatedIdentity {
  issuer: string;
  subject: string;
}

export interface AuthorizationRequest {
  identity: AuthenticatedIdentity;
  tenantId: string;
}

export type AuthorizationResult = SecurityContext;
