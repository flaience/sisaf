import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum([
    'development',
    'test',
    'production',
  ]).default('development'),

  DATABASE_URL: z.string()
    .min(1)
    .refine(
      value => {
        try {
          const url = new URL(value);
          return ['postgres:', 'postgresql:'].includes(
            url.protocol,
          );
        } catch {
          return false;
        }
      },
      'DATABASE_URL deve ser uma URL PostgreSQL válida',
    )
    .optional(),

  DB_POOL_MAX: z.coerce.number()
    .int()
    .min(1)
    .max(20)
    .default(5),
});

export type Environment = z.infer<typeof envSchema>;

export function getEnvironment(): Environment {
  return envSchema.parse(process.env);
}
