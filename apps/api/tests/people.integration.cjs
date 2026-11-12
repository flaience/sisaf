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

  const db = drizzle(pool);

  const service = new PeopleService(
    { db },
    new PersonCodeService(),
  );

  const tenantId = randomUUID();
  const otherTenantId = randomUUID();

  const companyId = randomUUID();
  const otherCompanyId = randomUUID();

  const unit = {
    id: companyId,
    type: 'headquarters',
  };

  const otherUnit = {
    id: otherCompanyId,
    type: 'headquarters',
  };

  const context = {
    actor: {
      id: randomUUID(),
      type: 'user',
    },
    tenantId,
    scope: {
      companyIds: [companyId],
      branchIds: [],
    },
    permissions: ['people:create'],
  };

  const personInput = (name, extra = {}) => ({
    unit,
    type: 'individual',
    name,
    ...extra,
  });

  try {
    await pool.query(
      `INSERT INTO sisaf_core.tenants
       (id, name, slug)
       VALUES
       ($1, 'Tenant Teste', $2),
       ($3, 'Outro Tenant', $4)`,
      [
        tenantId,
        `people-test-${tenantId}`,
        otherTenantId,
        `people-test-${otherTenantId}`,
      ],
    );

    // Matrizes criadas diretamente para preparar
    // o ambiente de teste. Nao utiliza people:create.
    await pool.query(
      `INSERT INTO sisaf_core.people
       (id, tenant_id, code, type, unit_type, name)
       VALUES
       ($1, $2, 1, 'organization',
        'headquarters', 'Matriz Teste'),
       ($3, $4, 1, 'organization',
        'headquarters', 'Matriz Outro Tenant')`,
      [
        companyId,
        tenantId,
        otherCompanyId,
        otherTenantId,
      ],
    );

    // A matriz ja ocupa o codigo 1.
    await pool.query(
      `INSERT INTO sisaf_core.person_code_counters
       (tenant_id, last_code)
       VALUES ($1, 1)`,
      [tenantId],
    );

    // 1. Bloqueio sem permissao.
    for (const permissions of [[], ['people:read']]) {
      await assert.rejects(
        service.create(
          { ...context, permissions },
          personInput('Sem Permissao'),
        ),
        (error) => error?.getStatus?.() === 403,
      );
    }

    console.log('PEOPLE_PERMISSION_DENIED_OK');

    // 2. Bloqueio fora do escopo.
    await assert.rejects(
      service.create(
        {
          ...context,
          scope: {
            companyIds: [],
            branchIds: [],
          },
        },
        personInput('Fora do Escopo'),
      ),
      (error) => error?.getStatus?.() === 403,
    );

    console.log('PEOPLE_UNIT_SCOPE_DENIED_OK');

    // 3. A unidade existe, mas pertence
    // a outro tenant. O contexto simulado
    // inclui essa unidade para testar
    // a verificacao adicional no banco.
    await assert.rejects(
      service.create(
        {
          ...context,
          scope: {
            companyIds: [otherCompanyId],
            branchIds: [],
          },
        },
        personInput('Tenant Invalido', {
          unit: otherUnit,
        }),
      ),
      (error) => error?.getStatus?.() === 400,
    );

    console.log('PEOPLE_CROSS_TENANT_DENIED_OK');

    // Nenhuma tentativa negada deve consumir codigo.
    const before = await pool.query(
      `SELECT last_code
       FROM sisaf_core.person_code_counters
       WHERE tenant_id = $1`,
      [tenantId],
    );

    assert.equal(before.rows[0].last_code, '1');

    // 4. Criacao com endereco.
    const first = await service.create(
      context,
      personInput('Empresa Teste', {
        type: 'organization',
        addresses: [{
          type: 'commercial',
          street: 'Rua Teste',
          number: '100',
          city: 'Caxias do Sul',
          state: 'RS',
          countryCode: 'BR',
          isPrimary: true,
        }],
      }),
    );

    assert.equal(first.code, '2');

    const details = await pool.query(
      `SELECT id
       FROM sisaf_core.addresses
       WHERE tenant_id = $1
         AND person_id = $2`,
      [tenantId, first.id],
    );

    assert.equal(details.rowCount, 1);

    const record = await pool.query(
      `SELECT responsible_unit_id,
              responsible_unit_type,
              unit_type
       FROM sisaf_core.people
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, first.id],
    );

    assert.equal(record.rowCount, 1);
    assert.equal(
      record.rows[0].responsible_unit_id,
      companyId,
    );
    assert.equal(
      record.rows[0].responsible_unit_type,
      'headquarters',
    );
    assert.equal(record.rows[0].unit_type, 'none');

    const links = await pool.query(
      `SELECT unit_id, unit_type
       FROM sisaf_core.person_units
       WHERE tenant_id = $1 AND person_id = $2`,
      [tenantId, first.id],
    );

    assert.equal(links.rowCount, 1);
    assert.equal(links.rows[0].unit_id, companyId);
    assert.equal(
      links.rows[0].unit_type,
      'headquarters',
    );

    console.log('PEOPLE_MASTER_DETAIL_OK');
    console.log('PEOPLE_UNIT_LINK_OK');

    // 5. Sequencia de codigo.
    const second = await service.create(
      context,
      personInput('Pessoa Teste'),
    );

    assert.equal(second.code, '3');
    console.log('PEOPLE_SEQUENCE_OK');

    // 6. Validacao rejeita dois enderecos principais.
    await assert.rejects(
      service.create(
        context,
        personInput('Cadastro Invalido', {
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
      ),
      (error) => error?.getStatus?.() === 400,
    );

    const afterValidation = await pool.query(
      `SELECT last_code
       FROM sisaf_core.person_code_counters
       WHERE tenant_id = $1`,
      [tenantId],
    );

    assert.equal(afterValidation.rows[0].last_code, '3');

    console.log('PEOPLE_VALIDATION_ROLLBACK_OK');

    // 7. Erro no banco deve reverter o codigo
    // e todas as insercoes da transacao.
    const document = '12345678901';

    const withDocument = await service.create(
      context,
      personInput('Pessoa Documento A', {
        taxId: document,
      }),
    );

    assert.equal(withDocument.code, '4');

    await assert.rejects(
      service.create(
        context,
        personInput('Documento Duplicado', {
          taxId: document,
        }),
      ),
      (error) =>
        error?.code === '23505' ||
        error?.cause?.code === '23505',
    );

    const afterFailure = await pool.query(
      `SELECT last_code
       FROM sisaf_core.person_code_counters
       WHERE tenant_id = $1`,
      [tenantId],
    );

    assert.equal(afterFailure.rows[0].last_code, '4');

    const personCount = await pool.query(
      `SELECT count(*)::int AS total
       FROM sisaf_core.people
       WHERE tenant_id = $1`,
      [tenantId],
    );

    // Matriz + tres pessoas criadas.
    assert.equal(personCount.rows[0].total, 4);

    const linkCount = await pool.query(
      `SELECT count(*)::int AS total
       FROM sisaf_core.person_units
       WHERE tenant_id = $1`,
      [tenantId],
    );

    assert.equal(linkCount.rows[0].total, 3);

    console.log('PEOPLE_DATABASE_ROLLBACK_OK');

    // 8. O proximo codigo nao pode ter lacuna
    // decorrente da transacao rejeitada.
    const next = await service.create(
      context,
      personInput('Pessoa Documento B', {
        taxId: '98765432100',
      }),
    );

    assert.equal(next.code, '5');

    console.log('PEOPLE_SEQUENCE_AFTER_ROLLBACK_OK');
    console.log('PEOPLE_INTEGRATION_OK');

  } finally {
    try {
      await pool.query('BEGIN');

      await pool.query(
        `DELETE FROM sisaf_core.person_units
         WHERE tenant_id = ANY($1::uuid[])`,
        [[tenantId, otherTenantId]],
      );

      await pool.query(
        `DELETE FROM sisaf_core.addresses
         WHERE tenant_id = ANY($1::uuid[])`,
        [[tenantId, otherTenantId]],
      );

      await pool.query(
        `DELETE FROM sisaf_core.people
         WHERE tenant_id = ANY($1::uuid[])`,
        [[tenantId, otherTenantId]],
      );

      await pool.query(
        `DELETE FROM sisaf_core.person_code_counters
         WHERE tenant_id = ANY($1::uuid[])`,
        [[tenantId, otherTenantId]],
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
