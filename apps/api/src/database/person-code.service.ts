import { Injectable } from '@nestjs/common';
import { reserveNextPersonCodeSql } from './person-code';

type TransactionExecutor = {
  execute: (
    query: ReturnType<typeof reserveNextPersonCodeSql>
  ) => Promise<{ rows: Record<string, unknown>[] }>;
};

@Injectable()
export class PersonCodeService {
  async reserveNext(
    tx: TransactionExecutor,
    tenantId: string,
  ): Promise<bigint> {
    const result = await tx.execute(
      reserveNextPersonCodeSql(tenantId),
    );

    const value = result.rows[0]?.last_code;

    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'bigint'
    ) {
      throw new Error(
        'Falha ao reservar codigo de pessoa',
      );
    }

    return BigInt(value);
  }
}
