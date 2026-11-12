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
import { and, eq } from 'drizzle-orm';
import { requireUnitAccess } from '../security/unit-access';
import {
  createPersonSchema,
  type CreatePersonInput,
} from './people.validation';
import { DatabaseProvider } from '../database/database.provider';
import { PersonCodeService } from '../database/person-code.service';
import {
  people,
  addresses,
  personUnits,
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

    requireUnitAccess(
      context,
      'people:create',
      data.unit,
    );

    const db = this.database.db;

    if (!db) {
      throw new ServiceUnavailableException(
        'Banco de dados indisponivel',
      );
    }

    return db.transaction(async (tx) => {
      const [unit] = await tx
        .select({ id: people.id })
        .from(people)
        .where(and(
          eq(people.tenantId, tenantId),
          eq(people.id, data.unit.id),
          eq(people.unitType, data.unit.type),
        ))
        .limit(1);

      if (!unit) {
        throw new BadRequestException(
          'Unidade operacional invalida para este tenant',
        );
      }

      const code = await this.codes.reserveNext(
        tx,
        tenantId,
      );

      const [person] = await tx
        .insert(people)
        .values({
          tenantId,
          code,
          unitType: 'none',
          responsibleUnitId: data.unit.id,
          responsibleUnitType: data.unit.type,
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

      await tx.insert(personUnits).values({
        tenantId,
        personId: person.id,
        unitId: data.unit.id,
        unitType: data.unit.type,
      });

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

  async shareWithUnit(
    context: SecurityContext,
    input: {
      personId: string;
      unit: {
        id: string;
        type: 'headquarters' | 'branch';
      };
    },
  ) {
    const parsed = z.strictObject({
      personId: z.uuid(),
      unit: z.strictObject({
        id: z.uuid(),
        type: z.enum(['headquarters', 'branch']),
      }),
    }).safeParse(input);

    if (!parsed.success) {
      throw new BadRequestException(
        'Dados de compartilhamento invalidos',
      );
    }

    const { personId, unit } = parsed.data;
    const tenantId = context.tenantId;

    if (!hasPermission(context, 'people:share')) {
      throw new ForbiddenException(
        'Permissao insuficiente para compartilhar pessoas',
      );
    }

    requireUnitAccess(
      context,
      'people:share',
      unit,
    );

    const db = this.database.db;

    if (!db) {
      throw new ServiceUnavailableException(
        'Banco de dados indisponivel',
      );
    }

    return db.transaction(async (tx) => {
      // A pessoa precisa existir no tenant e
      // ser um cadastro comum, nao uma unidade.
      const [person] = await tx
        .select({ id: people.id })
        .from(people)
        .where(and(
          eq(people.tenantId, tenantId),
          eq(people.id, personId),
          eq(people.unitType, 'none'),
        ))
        .limit(1);

      if (!person) {
        throw new ForbiddenException(
          'Pessoa indisponivel para compartilhamento',
        );
      }

      // Identificar unidades que ja utilizam
      // o cadastro, sempre dentro do tenant.
      const existingLinks = await tx
        .select({
          unitId: personUnits.unitId,
          unitType: personUnits.unitType,
        })
        .from(personUnits)
        .where(and(
          eq(personUnits.tenantId, tenantId),
          eq(personUnits.personId, personId),
        ));

      // O usuario precisa acessar pelo menos
      // uma das unidades de origem.
      const canAccessSource = existingLinks.some(
        (link) =>
          link.unitType === 'headquarters'
            ? context.scope.companyIds.includes(link.unitId)
            : context.scope.branchIds.includes(link.unitId),
      );

      if (!canAccessSource) {
        throw new ForbiddenException(
          'Acesso ao cadastro de origem negado',
        );
      }

      // Confirmar que a unidade de destino
      // realmente pertence ao mesmo tenant.
      const [destination] = await tx
        .select({ id: people.id })
        .from(people)
        .where(and(
          eq(people.tenantId, tenantId),
          eq(people.id, unit.id),
          eq(people.unitType, unit.type),
        ))
        .limit(1);

      if (!destination) {
        throw new BadRequestException(
          'Unidade de destino invalida',
        );
      }

      // Operacao idempotente: nao criar
      // relacionamentos duplicados.
      const inserted = await tx
        .insert(personUnits)
        .values({
          tenantId,
          personId,
          unitId: unit.id,
          unitType: unit.type,
        })
        .onConflictDoNothing()
        .returning({ id: personUnits.id });

      return {
        personId,
        unitId: unit.id,
        created: inserted.length > 0,
      };
    });
  }

}
