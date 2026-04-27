import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { verifyFirebaseToken, setFirebaseCustomClaims } from './firebase.js';

const JWT_SECRET = process.env.JWT_SECRET || 'boti-super-secret-key';
const SALT_ROUNDS = 10;
const SUPERADMIN_EMAIL = 'andyvercha@gmail.com';

export const FIREBASE_AUTH_ENABLED = process.env.FIREBASE_AUTH_ENABLED === 'true';

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  async comparePassword(password: string, hash: string | null): Promise<boolean> {
    if (!hash) return false;
    return bcrypt.compare(password, hash);
  }

  generateToken(payload: { userId: string; email: string; role: string; orgId: string }): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }

  verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch {
      return null;
    }
  }

  async verifyFirebaseAndResolveUser(token: string): Promise<{ userId: string; email: string; name: string; role: string; orgId: string; isNew: boolean } | null> {
    const decoded = await verifyFirebaseToken(token);
    if (!decoded?.email) return null;

    const email = decoded.email;
    const existing = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true, orgId: true, isActive: true },
    });

    if (existing) {
      if (!existing.isActive) return null;
      return { userId: existing.id, email: existing.email, name: existing.name ?? email, role: existing.role, orgId: existing.orgId ?? '', isNew: false };
    }

    const provisioned = await this.provisionFirebaseUser(email, decoded.name ?? email.split('@')[0], decoded.uid);
    return { ...provisioned, isNew: true };
  }

  async assignTrialPlan(orgId: string): Promise<void> {
    const trial = await this.prisma.plan.findUnique({ where: { slug: 'trial' } });
    if (!trial) return;
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + trial.trialDays * 24 * 60 * 60 * 1000);
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { planId: trial.id, planStartedAt: now, trialEndsAt, usageResetAt: now },
    });
  }

  private async provisionFirebaseUser(email: string, displayName: string, uid: string): Promise<{ userId: string; email: string; name: string; role: string; orgId: string }> {
    const isSuperAdmin = email === SUPERADMIN_EMAIL;
    const role = isSuperAdmin ? 'SUPERADMIN' : 'ADMIN';

    const emailSlug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const slug = `${emailSlug}-${Date.now().toString(36)}`;

    const org = await this.prisma.organization.create({
      data: { name: displayName, slug },
    });

    const user = await this.prisma.user.create({
      data: { email, name: displayName, passwordHash: null, role, isActive: true, orgId: org.id },
    });

    // Assign plan: superadmin gets Pro (unlimited), everyone else gets Trial
    if (isSuperAdmin) {
      const pro = await this.prisma.plan.findFirst({ where: { slug: 'pro', isActive: true } });
      await this.prisma.organization.update({
        where: { id: org.id },
        data: {
          planId: pro?.id ?? null,
          planStartedAt: new Date(),
          isActive: true,
        },
      });
    } else {
      await this.assignTrialPlan(org.id);
    }

    // Set Firebase custom claims so Firestore rules can check role
    await setFirebaseCustomClaims(uid, { role, orgId: org.id }).catch(() => {});

    return { userId: user.id, email: user.email, name: user.name ?? displayName, role: user.role, orgId: user.orgId ?? '' };
  }
}
