import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './drizzle-core',
  dialect: 'postgresql',
  migrations: { schema: 'drizzle', table: '__sisaf_core_migrations' },
  strict: true,
  verbose: true,
});
