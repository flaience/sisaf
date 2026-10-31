import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { getEnvironment } from '../config/env';

@Injectable()
export class DatabaseProvider implements OnModuleDestroy {
  private readonly pool: Pool | null;
  readonly db: NodePgDatabase | null;

  constructor() {
    const env = getEnvironment();

    if (!env.DATABASE_URL) {
      this.pool = null;
      this.db = null;
      return;
    }

    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: {
        rejectUnauthorized: true,
      },
    });

    this.db = drizzle(this.pool);
  }

  async checkConnection(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }

    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
    }
  }
}
