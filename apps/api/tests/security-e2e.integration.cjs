require('reflect-metadata');

const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { createServer } = require('node:https');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const {
  Controller, Get, Request, UseGuards, Module,
} = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { FastifyAdapter } = require('@nestjs/platform-fastify');

const { DatabaseProvider } =
  require('../dist/database/database.provider');
const { TokenVerifierService } =
  require('../dist/security/token-verifier.service');
const { AuthorizationService } =
  require('../dist/security/authorization.service');
const { SecurityContextResolverService } =
  require('../dist/security/security-context-resolver.service');
const { SecurityGuard } =
  require('../dist/security/security.guard');

async function main() {
  const { generateKeyPair, exportJWK, SignJWT } =
    await import('jose');

  const pool = new Pool({
    connectionString:
      'postgres://postgres@127.0.0.1:5432/sisaf_v5_validation',
    ssl: false,
  });

  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const identityId = randomUUID();
  const membershipId = randomUUID();
  const issuer = 'https://issuer.example.invalid';
  const subject = `security-e2e-${identityId}`;

  const trusted = await generateKeyPair('RS256');
  const jwk = await exportJWK(trusted.publicKey);
  jwk.kid = 'security-e2e-key';
  jwk.alg = 'RS256';
  jwk.use = 'sig';

  const jwksServer = createServer({
    key: readFileSync('/certs/server.key'),
    cert: readFileSync('/certs/server.crt'),
  }, (req, res) => {
    if (req.url !== '/jwks') {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, {
      'content-type': 'application/json',
    });
    res.end(JSON.stringify({ keys: [jwk] }));
  });

  let app;

  try {
    await new Promise((resolve) =>
      jwksServer.listen(0, '127.0.0.1', resolve)
    );

    process.env.OIDC_ISSUER = issuer;
    process.env.OIDC_AUDIENCE = 'sisaf-api';
    process.env.OIDC_JWKS_URI =
      `https://127.0.0.1:${jwksServer.address().port}/jwks`;

    await pool.query(
      `INSERT INTO sisaf_core.tenants (id,name,slug)
       VALUES ($1,'Tenant A',$2),($3,'Tenant B',$4)`,
      [tenantA, `e2e-${tenantA}`,
       tenantB, `e2e-${tenantB}`],
    );

    await pool.query(
      `INSERT INTO sisaf_core.identities
       (id,issuer,subject) VALUES ($1,$2,$3)`,
      [identityId, issuer, subject],
    );

    await pool.query(
      `INSERT INTO sisaf_core.tenant_memberships
       (id,tenant_id,identity_id) VALUES ($1,$2,$3)`,
      [membershipId, tenantA, identityId],
    );

    await pool.query(
      `INSERT INTO sisaf_core.membership_permissions
       (tenant_id,membership_id,permission)
       VALUES ($1,$2,'people:read')`,
      [tenantA, membershipId],
    );

    class TestController {
      run(request) {
        const context = request.securityContext;
        return {
          tenantId: context.tenantId,
          permissions: context.permissions,
        };
      }
    }

    Controller('security-e2e')(TestController);

    const descriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype, 'run',
    );
    Get()(TestController.prototype, 'run', descriptor);
    UseGuards(SecurityGuard)(
      TestController.prototype, 'run', descriptor,
    );
    Request()(TestController.prototype, 'run', 0);

    class TestModule {}

    Module({
      controllers: [TestController],
      providers: [
        {
          provide: DatabaseProvider,
          useValue: { db: drizzle(pool) },
        },
        TokenVerifierService,
        AuthorizationService,
        SecurityContextResolverService,
        SecurityGuard,
      ],
    })(TestModule);

    app = await NestFactory.create(
      TestModule,
      new FastifyAdapter(),
      { logger: false },
    );
    await app.init();

    const fastify = app.getHttpAdapter().getInstance();
    await fastify.ready();

    const token = await new SignJWT({})
      .setProtectedHeader({
        alg: 'RS256',
        kid: 'security-e2e-key',
      })
      .setIssuer(issuer)
      .setSubject(subject)
      .setAudience('sisaf-api')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(trusted.privateKey);

    const url = '/security-e2e';

    const missing = await fastify.inject({
      method: 'GET',
      url,
    });

    assert.equal(missing.statusCode, 401);
    console.log('E2E_MISSING_TOKEN_OK');

    const valid = await fastify.inject({
      method: 'GET',
      url,
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': tenantA,
      },
    });

    assert.equal(valid.statusCode, 200, valid.body);
    assert.deepEqual(JSON.parse(valid.body), {
      tenantId: tenantA,
      permissions: ['people:read'],
    });
    console.log('E2E_JWT_JWKS_POSTGRES_OK');

    const denied = await fastify.inject({
      method: 'GET',
      url,
      headers: {
        authorization: `Bearer ${token}`,
        'x-tenant-id': tenantB,
      },
    });

    assert.equal(denied.statusCode, 403, denied.body);
    console.log('E2E_CROSS_TENANT_DENIED_OK');

    const invalid = await fastify.inject({
      method: 'GET',
      url,
      headers: {
        authorization: 'Bearer invalid-token',
        'x-tenant-id': tenantA,
      },
    });

    assert.equal(invalid.statusCode, 401);
    console.log('E2E_INVALID_TOKEN_DENIED_OK');
    console.log('SECURITY_E2E_INTEGRATION_OK');

  } finally {
    if (app) await app.close();

    try {
      await pool.query('BEGIN');

      await pool.query(
        `DELETE FROM sisaf_core.membership_permissions
         WHERE membership_id = $1`,
        [membershipId],
      );
      await pool.query(
        `DELETE FROM sisaf_core.tenant_memberships
         WHERE id = $1`,
        [membershipId],
      );
      await pool.query(
        `DELETE FROM sisaf_core.identities
         WHERE id = $1`,
        [identityId],
      );
      await pool.query(
        `DELETE FROM sisaf_core.tenants
         WHERE id = ANY($1::uuid[])`,
        [[tenantA, tenantB]],
      );

      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Falha na limpeza:', error);
      process.exitCode = 1;
    }

    await pool.end();

    if (jwksServer.listening) {
      await new Promise((resolve) =>
        jwksServer.close(resolve)
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
