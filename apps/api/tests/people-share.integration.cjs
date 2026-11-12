const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');

const { PeopleService } =
  require('../dist/people/people.service');

const { PersonCodeService } =
  require('../dist/database/person-code.service');

async function main() {
  const pool = new Pool({
    connectionString:
      'postgres://postgres@127.0.0.1:5432/sisaf_v5_validation',
    ssl: false,
  });

  const service = new PeopleService(
    { db: drizzle(pool) },
    new PersonCodeService(),
  );

  const tenantId = randomUUID();
  const otherTenantId = randomUUID();

  const companyId = randomUUID();
  const branchId = randomUUID();
  const otherCompanyId = randomUUID();
  const supplierId = randomUUID();

  const destination = {
    id: branchId,
    type: 'branch',
  };

  const context = {
    actor: { id: randomUUID(), type: 'user' },
    tenantId,
    permissions: ['people:share'],
    scope: {
      companyIds: [companyId],
      branchIds: [branchId],
    },
  };

  const input = {
    personId: supplierId,
    unit: destination,
  };

  try {
    await pool.query(
      `INSERT INTO sisaf_core.tenants
       (id, name, slug)
       VALUES
       ($1, 'Tenant Compartilhamento', $2),
       ($3, 'Outro Tenant', $4)`,
      [
        tenantId,
        `share-${tenantId}`,
        otherTenantId,
        `share-${otherTenantId}`,
      ],
    );

    await pool.query(
      `INSERT INTO sisaf_core.people
       (id, tenant_id, code, type, unit_type, name,
        parent_person_id, parent_unit_type)
       VALUES
       ($1, $2, 1, 'organization',
        'headquarters', 'Matriz', NULL, NULL),
       ($3, $2, 2, 'organization',
        'branch', 'Filial', $1, 'headquarters'),
       ($4, $2, 3, 'organization',
        'none', 'Fornecedor', NULL, NULL),
       ($5, $6, 1, 'organization',
        'headquarters', 'Outra Matriz', NULL, NULL)`,
      [
        companyId,
        tenantId,
        branchId,
        supplierId,
        otherCompanyId,
        otherTenantId,
      ],
    );

    // Inicialmente o fornecedor pertence apenas
    // ao conjunto operacional da matriz.
    await pool.query(
      `INSERT INTO sisaf_core.person_units
       (tenant_id, person_id, unit_id, unit_type)
       VALUES ($1, $2, $3, 'headquarters')`,
      [tenantId, supplierId, companyId],
    );

    // Sem permissao.
    await assert.rejects(
      service.shareWithUnit(
        { ...context, permissions: [] },
        input,
      ),
      (error) => error?.getStatus?.() === 403,
    );

    console.log('SHARE_PERMISSION_DENIED_OK');

    // Sem acesso a unidade de origem.
    await assert.rejects(
      service.shareWithUnit(
        {
          ...context,
          scope: {
            companyIds: [],
            branchIds: [branchId],
          },
        },
        input,
      ),
      (error) => error?.getStatus?.() === 403,
    );

    console.log('SHARE_SOURCE_DENIED_OK');

    // Sem acesso a unidade de destino.
    await assert.rejects(
      service.shareWithUnit(
        {
          ...context,
          scope: {
            companyIds: [companyId],
            branchIds: [],
          },
        },
        input,
      ),
      (error) => error?.getStatus?.() === 403,
    );

    console.log('SHARE_DESTINATION_DENIED_OK');

    // Unidade de outro tenant, mesmo quando
    // incluida artificialmente no contexto.
    await assert.rejects(
      service.shareWithUnit(
        {
          ...context,
          scope: {
            companyIds: [companyId, otherCompanyId],
            branchIds: [branchId],
          },
        },
        {
          personId: supplierId,
          unit: {
            id: otherCompanyId,
            type: 'headquarters',
          },
        },
      ),
      (error) => error?.getStatus?.() === 400,
    );

    console.log('SHARE_CROSS_TENANT_DENIED_OK');

    // Estruturas empresariais nao podem ser
    // compartilhadas como cadastros comuns.
    await assert.rejects(
      service.shareWithUnit(context, {
        personId: companyId,
        unit: destination,
      }),
      (error) => error?.getStatus?.() === 403,
    );

    console.log('SHARE_COMPANY_DENIED_OK');

    // Duas requisicoes simultaneas disputam
    // a criacao do mesmo vinculo.
    const results = await Promise.all([
      service.shareWithUnit(context, input),
      service.shareWithUnit(context, input),
    ]);

    for (const result of results) {
      assert.equal(result.personId, supplierId);
      assert.equal(result.unitId, branchId);
    }

    const createdCount = results.filter(
      (result) => result.created === true,
    ).length;

    assert.equal(createdCount, 1);
    assert.equal(
      results.filter((result) => result.created === false).length,
      1,
    );

    console.log('SHARE_CONCURRENT_REQUESTS_OK');
    console.log('SHARE_MATRIX_TO_BRANCH_OK');

    // Repeticao nao deve criar outro vinculo.
    const repeated = await service.shareWithUnit(
      context,
      input,
    );

    assert.equal(repeated.created, false);

    const links = await pool.query(
      `SELECT unit_id
       FROM sisaf_core.person_units
       WHERE tenant_id = $1
         AND person_id = $2`,
      [tenantId, supplierId],
    );

    assert.equal(links.rowCount, 2);

    console.log('SHARE_IDEMPOTENCY_OK');

    const persons = await pool.query(
      `SELECT count(*)::int AS total
       FROM sisaf_core.people
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, supplierId],
    );

    assert.equal(persons.rows[0].total, 1);

    const counter = await pool.query(
      `SELECT count(*)::int AS total
       FROM sisaf_core.person_code_counters
       WHERE tenant_id = $1`,
      [tenantId],
    );

    assert.equal(counter.rows[0].total, 0);

    console.log('SHARE_NO_PERSON_DUPLICATION_OK');
    console.log('PEOPLE_SHARE_INTEGRATION_OK');

  } finally {
    try {
      await pool.query('BEGIN');

      await pool.query(
        `DELETE FROM sisaf_core.person_units
         WHERE tenant_id = ANY($1::uuid[])`,
        [[tenantId, otherTenantId]],
      );

      // Primeiro registros dependentes da matriz.
      await pool.query(
        `DELETE FROM sisaf_core.people
         WHERE tenant_id = $1
           AND id IN ($2, $3)`,
        [tenantId, branchId, supplierId],
      );

      await pool.query(
        `DELETE FROM sisaf_core.people
         WHERE tenant_id = $1
           AND id = $2`,
        [tenantId, companyId],
      );

      await pool.query(
        `DELETE FROM sisaf_core.people
         WHERE tenant_id = $1
           AND id = $2`,
        [otherTenantId, otherCompanyId],
      );

      await pool.query(
        `DELETE FROM sisaf_core.tenants
         WHERE id = ANY($1::uuid[])`,
        [[tenantId, otherTenantId]],
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
