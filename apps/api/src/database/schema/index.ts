import { sql } from 'drizzle-orm';

import {
  pgSchema,
  uuid,
  varchar,
  bigint,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  unique,
  foreignKey,
  check,
} from 'drizzle-orm/pg-core';

export const coreSchema = pgSchema('sisaf_core');

export const personTypeEnum = coreSchema.enum('person_type', [
  'individual',
  'organization',
]);

export const unitTypeEnum = coreSchema.enum('unit_type', [
  'none',
  'headquarters',
  'branch',
]);

export const tenants = coreSchema.table('tenants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow().notNull(),
}, (table) => [
  uniqueIndex('tenants_slug_uq').on(table.slug),
]);

export const people = coreSchema.table('people', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull()
    .references(() => tenants.id),
  code: bigint('code', { mode: 'bigint' }).notNull(),
  unitType: unitTypeEnum('unit_type').default('none').notNull(),
  parentPersonId: uuid('parent_person_id'),
  parentUnitType: unitTypeEnum('parent_unit_type'),
  responsibleUnitId: uuid('responsible_unit_id'),
  responsibleUnitType: unitTypeEnum('responsible_unit_type'),

  type: personTypeEnum('type').notNull(),
  name: varchar('name', { length: 250 }).notNull(),
  taxId: varchar('tax_id', { length: 14 }),
  nickname: varchar('nickname', { length: 255 }),
  phone: varchar('phone', { length: 30 }),
  email: varchar('email', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow().notNull(),
}, (table) => [
  check('people_unit_consistency_chk', sql`
    (
      unit_type = 'branch'
      AND parent_person_id IS NOT NULL
      AND type = 'organization'
    )
    OR
    (
      unit_type IN ('none', 'headquarters')
      AND parent_person_id IS NULL
      AND (
        unit_type = 'none'
        OR type = 'organization'
      )
    )
  `),
  check('people_responsible_unit_pair_chk', sql`
    (
      ${table.responsibleUnitId} IS NULL
      AND ${table.responsibleUnitType} IS NULL
    )
    OR
    (
      ${table.responsibleUnitId} IS NOT NULL
      AND ${table.responsibleUnitType} IS NOT NULL
      AND ${table.responsibleUnitType}
        IN ('headquarters', 'branch')
    )
  `),
  foreignKey({
    columns: [
      table.tenantId,
      table.responsibleUnitId,
      table.responsibleUnitType,
    ],
    foreignColumns: [
      table.tenantId,
      table.id,
      table.unitType,
    ],
    name: 'people_responsible_unit_same_tenant_fk',
  }),
  check('people_no_self_parent_chk', sql`
    parent_person_id IS NULL OR parent_person_id <> id
  `),
  index('people_tenant_idx').on(table.tenantId),
  index('people_parent_idx')
    .on(table.tenantId, table.parentPersonId),
  unique('people_tenant_id_uq').on(table.tenantId, table.id),
  unique('people_parent_lookup_uq')
    .on(table.tenantId, table.id, table.unitType),
  check('people_parent_type_chk', sql`
    (
      ${table.parentPersonId} IS NULL
      AND ${table.parentUnitType} IS NULL
    )
    OR
    (
      ${table.parentPersonId} IS NOT NULL
      AND ${table.parentUnitType} IS NOT NULL
      AND ${table.parentUnitType} = 'headquarters'
    )
  `),
  foreignKey({
    columns: [table.tenantId, table.parentPersonId, table.parentUnitType],
    foreignColumns: [table.tenantId, table.id, table.unitType],
    name: 'people_parent_same_tenant_fk',
  }),
  uniqueIndex('people_tenant_code_uq').on(table.tenantId, table.code),
  uniqueIndex('people_tenant_tax_id_uq')
    .on(table.tenantId, table.taxId),
]);

export const addresses = coreSchema.table('addresses', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  street: varchar('street', { length: 255 }).notNull(),
  number: varchar('number', { length: 20 }),
  complement: varchar('complement', { length: 150 }),
  district: varchar('district', { length: 150 }),
  city: varchar('city', { length: 150 }).notNull(),
  state: varchar('state', { length: 100 }),
  postalCode: varchar('postal_code', { length: 20 }),
  countryCode: varchar('country_code', { length: 2 }).notNull(),
  isPrimary: boolean('is_primary').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow().notNull(),
}, (table) => [
  index('addresses_person_idx').on(table.tenantId, table.personId),
  uniqueIndex('addresses_one_primary_uq')
    .on(table.tenantId, table.personId)
    .where(sql`${table.isPrimary} = true`),
  foreignKey({
    columns: [table.tenantId, table.personId],
    foreignColumns: [people.tenantId, people.id],
    name: 'addresses_person_same_tenant_fk',
  }),
]);

export const personRoles = coreSchema.table('person_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  personId: uuid('person_id').notNull(),
  role: varchar('role', { length: 40 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow().notNull(),
}, (table) => [
  uniqueIndex('person_roles_unique_uq')
    .on(table.tenantId, table.personId, table.role),
  foreignKey({
    columns: [table.tenantId, table.personId],
    foreignColumns: [people.tenantId, people.id],
    name: 'person_roles_person_same_tenant_fk',
  }),
]);

export const personCodeCounters = coreSchema.table(
  'person_code_counters',
  {
    tenantId: uuid('tenant_id')
      .primaryKey()
      .references(() => tenants.id),
    lastCode: bigint('last_code', { mode: 'bigint' })
      .default(sql`0`)
      .notNull(),
  },
  (table) => [
    check('person_code_counters_nonnegative_chk',
      sql`${table.lastCode} >= 0`),
  ],
);


// Identidades externas autenticadas via OIDC.
// A combinacao issuer + subject identifica a identidade.

export const identities = coreSchema.table('identities', {
  id: uuid('id').defaultRandom().primaryKey(),
  issuer: varchar('issuer', { length: 500 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  actorType: varchar('actor_type', { length: 20 })
    .default('user').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow().notNull(),
}, (table) => [
  uniqueIndex('identities_issuer_subject_uq')
    .on(table.issuer, table.subject),
  check('identities_actor_type_chk',
    sql`${table.actorType} IN ('user', 'service')`),
]);

// Uma identidade pode participar de varios tenants.
// O vinculo nao concede permissoes automaticamente.

export const tenantMemberships = coreSchema.table(
  'tenant_memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull()
      .references(() => tenants.id),
    identityId: uuid('identity_id').notNull()
      .references(() => identities.id),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tenant_memberships_identity_tenant_uq')
      .on(table.identityId, table.tenantId),
    unique('tenant_memberships_id_tenant_uq')
      .on(table.id, table.tenantId),
    index('tenant_memberships_tenant_idx')
      .on(table.tenantId),
  ],
);

// Permissoes vinculadas a uma participacao no tenant.
export const membershipPermissions = coreSchema.table(
  'membership_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    permission: varchar('permission', { length: 80 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('membership_permissions_unique_uq')
      .on(table.tenantId, table.membershipId, table.permission),
    foreignKey({
      columns: [table.membershipId, table.tenantId],
      foreignColumns: [
        tenantMemberships.id,
        tenantMemberships.tenantId,
      ],
      name: 'membership_permissions_same_tenant_fk',
    }),
  ],
);

// Unidades autorizadas para a identidade no tenant.
export const membershipUnits = coreSchema.table(
  'membership_units',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').notNull(),
    membershipId: uuid('membership_id').notNull(),
    personId: uuid('person_id').notNull(),
    unitType: unitTypeEnum('unit_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow().notNull(),
  },
  (table) => [
    check('membership_units_type_chk',
      sql`${table.unitType} IN ('headquarters', 'branch')`),
    uniqueIndex('membership_units_unique_uq')
      .on(table.tenantId, table.membershipId, table.personId),
    foreignKey({
      columns: [table.membershipId, table.tenantId],
      foreignColumns: [
        tenantMemberships.id,
        tenantMemberships.tenantId,
      ],
      name: 'membership_units_membership_same_tenant_fk',
    }),
    foreignKey({
      columns: [table.tenantId, table.personId, table.unitType],
      foreignColumns: [
        people.tenantId,
        people.id,
        people.unitType,
      ],
      name: 'membership_units_person_same_tenant_fk',
    }),
  ],
);

// Relaciona cadastros de Pessoas às unidades operacionais.
// Uma pessoa pode ser utilizada por varias matrizes e filiais.
// O relacionamento nao concede permissao ao usuario.

export const personUnits = coreSchema.table(
  'person_units',
  {
    id: uuid('id').defaultRandom().primaryKey(),

    tenantId: uuid('tenant_id').notNull(),

    personId: uuid('person_id').notNull(),

    unitId: uuid('unit_id').notNull(),

    unitType: unitTypeEnum('unit_type').notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
    }).defaultNow().notNull(),
  },
  (table) => [
    check('person_units_type_chk', sql`
      ${table.unitType} IN ('headquarters', 'branch')
    `),

    uniqueIndex('person_units_unique_uq')
      .on(table.tenantId, table.personId, table.unitId),

    index('person_units_unit_idx')
      .on(table.tenantId, table.unitId),

    foreignKey({
      columns: [
        table.tenantId,
        table.personId,
      ],
      foreignColumns: [
        people.tenantId,
        people.id,
      ],
      name: 'person_units_person_same_tenant_fk',
    }),

    foreignKey({
      columns: [
        table.tenantId,
        table.unitId,
        table.unitType,
      ],
      foreignColumns: [
        people.tenantId,
        people.id,
        people.unitType,
      ],
      name: 'person_units_unit_same_tenant_fk',
    }),
  ],
);
