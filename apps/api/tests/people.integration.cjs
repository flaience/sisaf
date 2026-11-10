const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');

const { PeopleService } = require('../dist/people/people.service');
const { PersonCodeService } =
  require('../dist/database/person-code.service');

async function main() {
  const pool = new Pool({
    connectionString:
      'postgres://postgres@127.0.0.1:5432/sisaf_v5_validation',
    ssl: false,
  });

  const db = drizzle(pool);
  const service = new PeopleService(
    { db },
    new PersonCodeService(),
  );

  const tenantId = randomUUID();

  // Simula um contexto previamente autenticado e autorizado.
  const context = {
    actor: { id: randomUUID(), type: 'user' },
    tenantId,
    scope: { companyIds: [], branchIds: [] },
    permissions: ['people:create'],
  };

  try {
    await pool.query(
      `INSERT INTO sisaf_core.tenants (id, name, slug)
       VALUES ($1, $2, $3)`,
      [tenantId, 'Teste Integracao', `test-${tenantId}`],
    );


    for (const permissions of [[], ['people:read']]) {
      const unauthorizedContext = {
        ...context,
        permissions,
      };

      await assert.rejects(
        service.create(unauthorizedContext, {
          type: 'individual',
          name: 'Pessoa Nao Autorizada',
        }),
        (error) => error?.getStatus?.() === 403,
      );
    }

    const deniedPeople = await pool.query(
      `SELECT count(*)::int AS total
       FROM sisaf_core.people
       WHERE tenant_id = $1`,
      [tenantId],
    );

    const deniedCounter = await pool.query(
      `SELECT count(*)::int AS total
       FROM sisaf_core.person_code_counters
       WHERE tenant_id = $1`,
      [tenantId],
    );

    assert.equal(deniedPeople.rows[0].total, 0);
    assert.equal(deniedCounter.rows[0].total, 0);

    console.log('PEOPLE_PERMISSION_DENIED_OK');

    const first = await service.create(context, {
      type: 'organization',
      name: 'Empresa Teste',
      addresses: [{
        type: 'commercial',
        street: 'Rua Teste',
        number: '100',
        city: 'Caxias do Sul',
        state: 'RS',
        countryCode: 'BR',
        isPrimary: true,
      }],
    });

    assert.equal(first.code, '1');

    const details = await pool.query(
      `SELECT id FROM sisaf_core.addresses
       WHERE tenant_id = $1 AND person_id = $2`,
      [tenantId, first.id],
    );

    assert.equal(details.rowCount, 1);
    console.log('PEOPLE_MASTER_DETAIL_OK');

    const second = await service.create(context, {
      type: 'individual',
      name: 'Pessoa Teste',
    });

    assert.equal(second.code, '2');
    console.log('PEOPLE_SEQUENCE_OK');

    await assert.rejects(
      service.create(context, {
        type: 'organization',
        name: 'Cadastro Invalido',
        addresses: [
          {
            type: 'commercial',
            street: 'Rua A',
            city: 'Caxias do Sul',
            countryCode: 'BR',
            isPrimary: true,
          },
          {
            type: 'billing',
            street: 'Rua B',
            city: 'Caxias do Sul',
            countryCode: 'BR',
            isPrimary: true,
          },
        ],
      }),
    );

    const counter = await pool.query(
      `SELECT last_code
       FROM sisaf_core.person_code_counters
       WHERE tenant_id = $1`,
      [tenantId],
    );

    assert.equal(counter.rows[0].last_code, '2');

    const count = await pool.query(
      `SELECT count(*)::int AS total
       FROM sisaf_core.people
       WHERE tenant_id = $1`,
      [tenantId],
    );

    assert.equal(count.rows[0].total, 2);
    console.log('PEOPLE_TRANSACTION_ROLLBACK_OK');


    const document = '12345678901';

    const withDocument = await service.create(context, {
      type: 'individual',
      name: 'Pessoa Documento A',
      taxId: document,
    });

    assert.equal(withDocument.code, '3');

    await assert.rejects(
      service.create(context, {
        type: 'individual',
        name: 'Pessoa Documento Duplicado',
        taxId: document,
      }),
      (error) => error?.code === '23505' ||
        error?.cause?.code === '23505',
    );

    const afterFailure = await pool.query(
      `SELECT last_code
       FROM sisaf_core.person_code_counters
       WHERE tenant_id = $1`,
      [tenantId],
    );

    assert.equal(afterFailure.rows[0].last_code, '3');

    const next = await service.create(context, {
      type: 'individual',
      name: 'Pessoa Documento B',
      taxId: '98765432100',
    });

    assert.equal(next.code, '4');

    console.log('PEOPLE_DATABASE_ROLLBACK_OK');

    console.log('PEOPLE_INTEGRATION_OK');
  } finally {
    try {
      await pool.query('BEGIN');

      await pool.query(
        `DELETE FROM sisaf_core.addresses
         WHERE tenant_id = $1`,
        [tenantId],
      );

      await pool.query(
        `DELETE FROM sisaf_core.people
         WHERE tenant_id = $1`,
        [tenantId],
      );

      await pool.query(
        `DELETE FROM sisaf_core.person_code_counters
         WHERE tenant_id = $1`,
        [tenantId],
      );

      await pool.query(
        `DELETE FROM sisaf_core.tenants
         WHERE id = $1`,
        [tenantId],
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
