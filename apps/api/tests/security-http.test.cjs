require('reflect-metadata');

const assert = require('node:assert/strict');

const {
  Controller,
  Get,
  Module,
  UseGuards,
} = require('@nestjs/common');

const { NestFactory } = require('@nestjs/core');

const {
  FastifyAdapter,
} = require('@nestjs/platform-fastify');

const {
  SecurityGuard,
} = require('../dist/security/security.guard');

const tenantId = '11111111-1111-4111-8111-111111111111';

class ProtectedController {
  getProtected(request) {
    return {
      tenantId: request.securityContext.tenantId,
      permissions: request.securityContext.permissions,
    };
  }
}

Controller('test-security')(ProtectedController);

const descriptor = Object.getOwnPropertyDescriptor(
  ProtectedController.prototype,
  'getProtected',
);

Get()(ProtectedController.prototype, 'getProtected', descriptor);

UseGuards(SecurityGuard)(
  ProtectedController.prototype,
  'getProtected',
  descriptor,
);

const {
  Request,
} = require('@nestjs/common');

Request()(
  ProtectedController.prototype,
  'getProtected',
  0,
);

class TestModule {}

Module({
  controllers: [ProtectedController],
  providers: [
    {
      provide: require(
        '../dist/security/security-context-resolver.service'
      ).SecurityContextResolverService,
      useValue: {
        resolve: async (token, requestedTenant) => {
          const {
            UnauthorizedException,
            ForbiddenException,
          } = require('@nestjs/common');

          if (token !== 'valid-token') {
            throw new UnauthorizedException();
          }

          if (requestedTenant !== tenantId) {
            throw new ForbiddenException();
          }

          return {
            actor: { id: 'test-user', type: 'user' },
            tenantId,
            permissions: ['people:read'],
            scope: { companyIds: [], branchIds: [] },
          };
        },
      },
    },

  ],
})(TestModule);

async function main() {
  const app = await NestFactory.create(
    TestModule,
    new FastifyAdapter(),
    { logger: ['error', 'warn', 'log'] },
  );

  await app.init();
  await app.getHttpAdapter().getInstance().ready();

  try {
    const server = app.getHttpAdapter().getInstance();

    const missing = await server.inject({
      method: 'GET',
      url: '/test-security',
    });

    assert.equal(missing.statusCode, 401);
    console.log('HTTP_MISSING_TOKEN_OK');

    const invalid = await server.inject({
      method: 'GET',
      url: '/test-security',
      headers: {
        authorization: 'Bearer invalid-token',
        'x-tenant-id': tenantId,
      },
    });

    assert.equal(invalid.statusCode, 401);
    console.log('HTTP_INVALID_TOKEN_OK');

    const allowed = await server.inject({
      method: 'GET',
      url: '/test-security',
      headers: {
        authorization: 'Bearer valid-token',
        'x-tenant-id': tenantId,
      },
    });

    assert.equal(allowed.statusCode, 200);

    assert.deepEqual(JSON.parse(allowed.body), {
      tenantId,
      permissions: ['people:read'],
    });

    console.log('HTTP_AUTHORIZED_CONTEXT_OK');
    console.log('SECURITY_HTTP_TESTS_OK');
  } finally {
    await app.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
