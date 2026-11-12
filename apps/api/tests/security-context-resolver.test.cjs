const assert = require('node:assert/strict');
const {
  UnauthorizedException,
  ForbiddenException,
} = require('@nestjs/common');

const {
  SecurityContextResolverService,
} = require(
  '../dist/security/security-context-resolver.service'
);

async function main() {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const issuer = 'https://issuer.example.invalid';
  const subject = 'test-user';

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

  let authorizationCalls = 0;

  const validVerifier = {
    verify: async () => ({
      iss: issuer,
      sub: subject,
    }),
  };

  const allowedAuthorization = {
    resolve: async (request) => {
      authorizationCalls++;

      assert.deepEqual(request, {
        identity: { issuer, subject },
        tenantId,
      });

      return expectedContext;
    },
  };

  const resolver = new SecurityContextResolverService(
    validVerifier,
    allowedAuthorization,
  );

  const result = await resolver.resolve(
    'valid-test-token',
    tenantId,
  );

  assert.deepEqual(result, expectedContext);
  assert.equal(authorizationCalls, 1);

  console.log('SECURITY_CONTEXT_VALID_OK');

  authorizationCalls = 0;

  const invalidVerifier = {
    verify: async () => {
      throw new UnauthorizedException('Token invalido');
    },
  };

  const invalidResolver = new SecurityContextResolverService(
    invalidVerifier,
    allowedAuthorization,
  );

  await assert.rejects(
    invalidResolver.resolve('invalid-token', tenantId),
    (error) => error?.getStatus?.() === 401,
  );

  assert.equal(authorizationCalls, 0);

  console.log('SECURITY_CONTEXT_INVALID_TOKEN_OK');

  const deniedAuthorization = {
    resolve: async () => {
      throw new ForbiddenException('Acesso negado');
    },
  };

  const deniedResolver = new SecurityContextResolverService(
    validVerifier,
    deniedAuthorization,
  );

  await assert.rejects(
    deniedResolver.resolve('valid-test-token', tenantId),
    (error) => error?.getStatus?.() === 403,
  );

  console.log('SECURITY_CONTEXT_TENANT_DENIED_OK');
  console.log('SECURITY_CONTEXT_RESOLVER_OK');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
