import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  SecurityContext,
  hasPermission,
} from '../security/security-context';
import { z } from 'zod';
import {
  createPersonSchema,
  type CreatePersonInput,
} from './people.validation';
import { DatabaseProvider } from '../database/database.provider';
import { PersonCodeService } from '../database/person-code.service';
import {
  people,
  addresses,
} from '../database/schema';

@Injectable()
export class PeopleService {
  constructor(
    private readonly database: DatabaseProvider,
    private readonly codes: PersonCodeService,
  ) {}

  async create(
    context: SecurityContext,
    input: CreatePersonInput,
  ) {
    if (!hasPermission(context, 'people:create')) {
      throw new ForbiddenException(
        'Permissao insuficiente para criar pessoas',
      );
    }

    const tenantId = context.tenantId;

    const parsed = createPersonSchema.safeParse(input);

    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Dados de pessoa invalidos',
        errors: z.flattenError(parsed.error),
      });
    }

    const data = parsed.data;
    const db = this.database.db;

    if (!db) {
      throw new ServiceUnavailableException(
        'Banco de dados indisponivel',
      );
    }

    return db.transaction(async (tx) => {
      const code = await this.codes.reserveNext(
        tx,
        tenantId,
      );

      const [person] = await tx
        .insert(people)
        .values({
          tenantId,
          code,
          type: data.type,
          name: data.name,
          nickname: data.nickname,
          taxId: data.taxId,
          phone: data.phone,
          email: data.email,
        })
        .returning();

      if (!person) {
        throw new Error('Falha ao criar pessoa');
      }

      const details = data.addresses ?? [];

      if (details.length > 0) {
        await tx.insert(addresses).values(
          details.map((address) => ({
            ...address,
            tenantId,
            personId: person.id,
          })),
        );
      }

      return {
        id: person.id,
        code: person.code.toString(),
      };
    });
  }
}
