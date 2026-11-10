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

  DATABASE_URL_FILE: z.string().min(1).optional(),

  OIDC_ISSUER: z.string().url().refine(
    value => value.startsWith('https://'),
    'OIDC_ISSUER deve utilizar HTTPS',
  ).optional(),

  OIDC_AUDIENCE: z.string().min(1).optional(),

  OIDC_JWKS_URI: z.string().url().refine(
    value => value.startsWith('https://'),
    'OIDC_JWKS_URI deve utilizar HTTPS',
  ).optional(),

  DB_POOL_MAX: z.coerce.number()
    .int()
    .min(1)
    .max(20)
    .default(5),
}).superRefine((env, ctx) => {
  const oidcValues = [
    env.OIDC_ISSUER,
    env.OIDC_AUDIENCE,
    env.OIDC_JWKS_URI,
  ];

  const configured = oidcValues.filter(Boolean).length;

  if (configured !== 0 && configured !== 3) {
    ctx.addIssue({
      code: 'custom',
      message: 'Configure todas as variaveis OIDC ou nenhuma',
      path: ['OIDC_ISSUER'],
    });
  }
});

export type Environment = z.infer<typeof envSchema>;

export function getEnvironment(): Environment {
  return envSchema.parse(process.env);
}
