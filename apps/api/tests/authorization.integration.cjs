const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');

const { AuthorizationService } =
  require('../dist/security/authorization.service');

async function main() {
  const pool = new Pool({
    connectionString:
      'postgres://postgres@127.0.0.1:5432/sisaf_v5_validation',
    ssl: false,
  });

  const service = new AuthorizationService({
    db: drizzle(pool),
  });

  const identityId = randomUUID();
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const tenantC = randomUUID();
  const memberA = randomUUID();
  const memberB = randomUUID();
  const companyId = randomUUID();

  const identity = {
    issuer: 'https://issuer.example.invalid',
    subject: `auth-test-${identityId}`,
  };

  const resolve = (tenantId) =>
    service.resolve({ identity, tenantId });

  try {
    for (const [id, name] of [
      [tenantA, 'Tenant A'],
      [tenantB, 'Tenant B'],
      [tenantC, 'Tenant C'],
    ]) {
      await pool.query(
        `INSERT INTO sisaf_core.tenants (id, name, slug)
         VALUES ($1, $2, $3)`,
        [id, name, `auth-test-${id}`],
      );
    }

    await pool.query(
      `INSERT INTO sisaf_core.identities
        (id, issuer, subject)
       VALUES ($1, $2, $3)`,
      [identityId, identity.issuer, identity.subject],
    );

    for (const [id, tenantId] of [
      [memberA, tenantA],
      [memberB, tenantB],
    ]) {
      await pool.query(
        `INSERT INTO sisaf_core.tenant_memberships
          (id, tenant_id, identity_id)
         VALUES ($1, $2, $3)`,
        [id, tenantId, identityId],
      );
    }

    await pool.query(
      `INSERT INTO sisaf_core.membership_permissions
        (tenant_id, membership_id, permission)
       VALUES
         ($1, $2, 'people:create'),
         ($1, $2, 'people:share')`,
      [tenantA, memberA],
    );

    await pool.query(
      `INSERT INTO sisaf_core.people
        (id, tenant_id, code, type, unit_type, name)
       VALUES ($1, $2, 1, 'organization',
         'headquarters', 'Matriz Autorizada')`,
      [companyId, tenantA],
    );

    await pool.query(
      `INSERT INTO sisaf_core.membership_units
        (tenant_id, membership_id, person_id, unit_type)
       VALUES ($1, $2, $3, 'headquarters')`,
      [tenantA, memberA, companyId],
    );

    const contextA = await resolve(tenantA);

    assert.equal(contextA.actor.id, identityId);
    assert.equal(contextA.tenantId, tenantA);
    assert.deepEqual(
      [...contextA.permissions].sort(),
      ['people:create', 'people:share'],
    );

    console.log('AUTHORIZATION_PEOPLE_SHARE_DB_OK');
    assert.deepEqual(contextA.scope.companyIds, [
      companyId,
    ]);
    assert.deepEqual(contextA.scope.branchIds, []);

    console.log('AUTHORIZATION_VALID_MEMBERSHIP_OK');
    console.log('AUTHORIZATION_COMPANY_SCOPE_OK');

    const contextB = await resolve(tenantB);

    assert.deepEqual(contextB.permissions, []);
    assert.deepEqual(contextB.scope.companyIds, []);
    assert.deepEqual(contextB.scope.branchIds, []);

    console.log('AUTHORIZATION_TENANT_ISOLATION_OK');
    console.log('AUTHORIZATION_EMPTY_PERMISSIONS_OK');

    await assert.rejects(
      resolve(tenantC),
      (error) => error?.getStatus?.() === 403,
    );

    console.log('AUTHORIZATION_NO_MEMBERSHIP_OK');

    // JWT real e AuthorizationService com PostgreSQL real.
    const { generateKeyPair, SignJWT } = await import('jose');

    const { validateJwt } = require(
      '../dist/security/jwt-validator'
    );

    const { SecurityContextResolverService } = require(
      '../dist/security/security-context-resolver.service'
    );

    const { publicKey, privateKey } =
      await generateKeyPair('RS256');

    const audience = 'sisaf-api';

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(identity.issuer)
      .setSubject(identity.subject)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    const verifier = {
      verify: (value) => validateJwt(
        value,
        async () => publicKey,
        identity.issuer,
        audience,
      ),
    };

    const securityResolver =
      new SecurityContextResolverService(
        verifier,
        service,
      );

    const securedContext = await securityResolver.resolve(
      token,
      tenantA,
    );

    assert.equal(securedContext.actor.id, identityId);
    assert.equal(securedContext.tenantId, tenantA);

    assert.deepEqual(
      [...securedContext.permissions].sort(),
      ['people:create', 'people:share'],
    );

    console.log('JWT_PEOPLE_SHARE_PERMISSION_OK');

    assert.deepEqual(
      securedContext.scope.companyIds,
      [companyId],
    );

    console.log('JWT_DATABASE_AUTHORIZATION_OK');

    await assert.rejects(
      securityResolver.resolve(token, tenantC),
      (error) => error?.getStatus?.() === 403,
    );

    console.log('JWT_CROSS_TENANT_DENIED_OK');



    await pool.query(
      `UPDATE sisaf_core.tenant_memberships
       SET is_active = false WHERE id = $1`,
      [memberA],
    );

    await assert.rejects(
      resolve(tenantA),
      (error) => error?.getStatus?.() === 403,
    );

    console.log('AUTHORIZATION_INACTIVE_MEMBERSHIP_OK');

    await pool.query(
      `UPDATE sisaf_core.tenant_memberships
       SET is_active = true WHERE id = $1`,
      [memberA],
    );

    await pool.query(
      `UPDATE sisaf_core.identities
       SET is_active = false WHERE id = $1`,
      [identityId],
    );

    await assert.rejects(
      resolve(tenantA),
      (error) => error?.getStatus?.() === 403,
    );

    console.log('AUTHORIZATION_INACTIVE_IDENTITY_OK');
    console.log('AUTHORIZATION_INTEGRATION_OK');

  } finally {
    try {
      await pool.query('BEGIN');

      for (const table of [
        'membership_units',
        'membership_permissions',
        'tenant_memberships',
      ]) {
        await pool.query(
          `DELETE FROM sisaf_core.${table}
           WHERE tenant_id = ANY($1::uuid[])`,
          [[tenantA, tenantB, tenantC]],
        );
      }

      await pool.query(
        `DELETE FROM sisaf_core.people
         WHERE id = $1 AND tenant_id = $2`,
        [companyId, tenantA],
      );

      await pool.query(
        `DELETE FROM sisaf_core.identities
         WHERE id = $1`,
        [identityId],
      );

      await pool.query(
        `DELETE FROM sisaf_core.tenants
         WHERE id = ANY($1::uuid[])`,
        [[tenantA, tenantB, tenantC]],
      );

      await pool.query('COMMIT');
    } catch (error) {
      await pool.query('ROLLBACK');
      console.error('Falha na limpeza:', error);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
