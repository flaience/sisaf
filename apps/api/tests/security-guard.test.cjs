const assert = require('node:assert/strict');

const {
  UnauthorizedException,
  ForbiddenException,
} = require('@nestjs/common');

const {
  SecurityGuard,
} = require('../dist/security/security.guard');

async function main() {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  const expectedContext = {
    actor: {
      id: '22222222-2222-4222-8222-222222222222',
      type: 'user',
    },
    tenantId,
    permissions: ['people:read'],
    scope: {
      companyIds: [],
      branchIds: [],
    },
  };

  let resolverCalls = 0;

  const resolver = {
    resolve: async (token, tenant) => {
      resolverCalls++;
      assert.equal(token, 'valid-token');
      assert.equal(tenant, tenantId);
      return expectedContext;
    },
  };

  const guard = new SecurityGuard(resolver);

  const executionContext = (headers) => {
    const request = { headers };

    return {
      request,
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      },
    };
  };

  async function expectDenied(
    headers,
    expectedStatus,
  ) {
    const { context } = executionContext(headers);

    await assert.rejects(
      guard.canActivate(context),
      (error) => error?.getStatus?.() === expectedStatus,
    );
  }

  await expectDenied({}, 401);
  console.log('GUARD_MISSING_TOKEN_OK');

  await expectDenied({
    authorization: 'Basic invalid',
    'x-tenant-id': tenantId,
  }, 401);

  console.log('GUARD_INVALID_AUTH_HEADER_OK');

  await expectDenied({
    authorization: 'Bearer valid-token',
  }, 400);

  await expectDenied({
    authorization: 'Bearer valid-token',
    'x-tenant-id': 'invalid-tenant',
  }, 400);

  console.log('GUARD_INVALID_TENANT_OK');

  assert.equal(resolverCalls, 0);

  const deniedGuard = new SecurityGuard({
    resolve: async () => {
      throw new ForbiddenException('Tenant negado');
    },
  });

  const denied = executionContext({
    authorization: 'Bearer valid-token',
    'x-tenant-id': tenantId,
  });

  await assert.rejects(
    deniedGuard.canActivate(denied.context),
    (error) => error?.getStatus?.() === 403,
  );

  console.log('GUARD_TENANT_DENIED_OK');

  const invalidTokenGuard = new SecurityGuard({
    resolve: async () => {
      throw new UnauthorizedException('Token invalido');
    },
  });

  const invalid = executionContext({
    authorization: 'Bearer invalid-token',
    'x-tenant-id': tenantId,
  });

  await assert.rejects(
    invalidTokenGuard.canActivate(invalid.context),
    (error) => error?.getStatus?.() === 401,
  );

  console.log('GUARD_INVALID_TOKEN_OK');

  const allowed = executionContext({
    authorization: 'Bearer valid-token',
    'x-tenant-id': tenantId,
  });

  const result = await guard.canActivate(allowed.context);

  assert.equal(result, true);
  assert.equal(resolverCalls, 1);
  assert.deepEqual(
    allowed.request.securityContext,
    expectedContext,
  );

  console.log('GUARD_AUTHORIZED_CONTEXT_OK');
  console.log('SECURITY_GUARD_TESTS_OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
