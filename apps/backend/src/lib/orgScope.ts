import type { Request } from 'express';

/** Spread into every Prisma where/data clause to enforce org isolation. */
export const orgScope = (req: Request): { orgId: string } => ({
  orgId: (req as any).user.orgId,
});
