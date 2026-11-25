import { z } from "zod";

export const envelope = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  data: z.unknown().optional(),
  pagination: z.unknown().optional(),
  errorCode: z.string().optional(),
  requestId: z.string().optional(),
  errors: z.unknown().optional(),
  details: z.unknown().optional(),
});
export const sessionSchema = z.object({
  user: z.object({
    _id: z.string(),
    name: z.string(),
    email: z.string().optional(),
  }),
});
export type Session = z.infer<typeof sessionSchema>;
export const loginSchema = z.object({
  email: z.string().trim().min(1, "Enter your email or mobile number").max(254),
  password: z.string().min(1, "Enter your password").max(256),
});

export const rowSchema = z.object({ _id: z.string() }).catchall(z.unknown());
export type Row = z.infer<typeof rowSchema>;
export const rowsSchema = z.array(rowSchema);
export const paginationSchema = z.object({
  page: z.number(),
  limit: z.number().optional(),
  total: z.number(),
  pages: z.number().optional(),
  totalPages: z.number().optional(),
});
export const analyticsSchema = z.object({
  pgs: z.object({
    total: z.number(),
    approved: z.number(),
    pending: z.number(),
    rejected: z.number(),
    verified: z.number(),
  }),
  users: z.object({
    total: z.number(),
    tenants: z.number(),
    owners: z.number(),
  }),
  activity: z.object({ leads: z.number(), visits: z.number() }),
  cityStats: z.array(z.object({ _id: z.string(), count: z.number() })),
});

export function valueAt(value: unknown, key: string): unknown {
  let current = value;
  for (const segment of key.split(".")) {
    if (
      !current ||
      typeof current !== "object" ||
      !Object.hasOwn(current, segment)
    )
      return undefined;
    current = Reflect.get(current, segment);
  }
  return current;
}
