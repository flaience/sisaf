const assert = require('node:assert/strict');

const {
  requireUnitAccess,
} = require('../dist/security/unit-access');

const companyId =
  '11111111-1111-4111-8111-111111111111';

const branchId =
  '22222222-2222-4222-8222-222222222222';

const otherCompanyId =
  '33333333-3333-4333-8333-333333333333';

const context = {
  actor: { id: 'test-user', type: 'user' },
  tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  permissions: ['people:create'],
  scope: {
    companyIds: [companyId],
    branchIds: [branchId],
  },
};

requireUnitAccess(
  context,
  'people:create',
  { id: companyId, type: 'headquarters' },
);

console.log('UNIT_ACCESS_COMPANY_OK');

requireUnitAccess(
  context,
  'people:create',
  { id: branchId, type: 'branch' },
);

console.log('UNIT_ACCESS_BRANCH_OK');

assert.throws(
  () => requireUnitAccess(
    context,
    'people:create',
    { id: otherCompanyId, type: 'headquarters' },
  ),
  (error) => error?.getStatus?.() === 403,
);

console.log('UNIT_ACCESS_OUT_OF_SCOPE_DENIED_OK');

assert.throws(
  () => requireUnitAccess(
    { ...context, permissions: ['people:read'] },
    'people:create',
    { id: companyId, type: 'headquarters' },
  ),
  (error) => error?.getStatus?.() === 403,
);

console.log('UNIT_ACCESS_PERMISSION_DENIED_OK');
console.log('UNIT_ACCESS_TESTS_OK');
