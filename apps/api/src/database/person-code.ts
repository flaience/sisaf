import { sql } from 'drizzle-orm';

export function reserveNextPersonCodeSql(tenantId: string) {
  return sql`
    INSERT INTO sisaf_core.person_code_counters
      (tenant_id, last_code)
    VALUES (${tenantId}::uuid, 1)
    ON CONFLICT (tenant_id)
    DO UPDATE SET
      last_code =
        sisaf_core.person_code_counters.last_code + 1
    RETURNING last_code
  `;
}
