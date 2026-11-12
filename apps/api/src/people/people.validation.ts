import { z } from 'zod';

const optionalText = (max: number) =>
  z.string().trim().max(max).optional();

export const addressInputSchema = z.strictObject({
  type: z.string().trim().min(1).max(30),
  street: z.string().trim().min(1).max(255),
  number: optionalText(20),
  complement: optionalText(150),
  district: optionalText(150),
  city: z.string().trim().min(1).max(150),
  state: optionalText(100),
  postalCode: optionalText(20),
  countryCode: z.string().trim()
    .length(2)
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase()),
  isPrimary: z.boolean().optional(),
});

export const createPersonSchema = z.strictObject({
  unit: z.strictObject({
    id: z.uuid(),
    type: z.enum(['headquarters', 'branch']),
  }),
  type: z.enum(['individual', 'organization']),
  name: z.string().trim().min(1).max(250),
  nickname: optionalText(255),
  taxId: optionalText(14),
  phone: optionalText(30),
  email: z.email().max(255).optional(),
  addresses: z.array(addressInputSchema).optional(),
}).superRefine((input, ctx) => {
  const primaryCount = (input.addresses ?? [])
    .filter((address) => address.isPrimary === true)
    .length;

  if (primaryCount > 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['addresses'],
      message: 'Apenas um endereco pode ser principal',
    });
  }
});

export type CreatePersonInput =
  z.input<typeof createPersonSchema>;

export type ValidatedPersonInput =
  z.output<typeof createPersonSchema>;
