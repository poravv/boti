import type { Request } from 'express';

/** Spread into every Prisma where/data clause to enforce org isolation. */
export const orgScope = (req: Request): { orgId: string } => {
  const orgId = (req as any).user?.orgId as string | undefined;
  if (!orgId) throw Object.assign(new Error('orgId requerido — acceso denegado'), { status: 403 });
  return { orgId };
};
