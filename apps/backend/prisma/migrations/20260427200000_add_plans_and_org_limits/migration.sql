-- Plan table
CREATE TABLE IF NOT EXISTS "Plan" (
  "id"                       TEXT NOT NULL PRIMARY KEY,
  "name"                     TEXT NOT NULL,
  "slug"                     TEXT NOT NULL UNIQUE,
  "price"                    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxLines"                 INTEGER NOT NULL DEFAULT 1,
  "maxUsers"                 INTEGER NOT NULL DEFAULT 2,
  "maxConversationsPerMonth" INTEGER NOT NULL DEFAULT 200,
  "trialDays"                INTEGER NOT NULL DEFAULT 0,
  "aiEnabled"                BOOLEAN NOT NULL DEFAULT true,
  "isActive"                 BOOLEAN NOT NULL DEFAULT true,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Organization: new columns
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "planId"                 TEXT REFERENCES "Plan"("id"),
  ADD COLUMN IF NOT EXISTS "planStartedAt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "trialEndsAt"            TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isActive"               BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "conversationsThisMonth" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "usageResetAt"           TIMESTAMP(3);

-- Seed default plans (idempotent)
INSERT INTO "Plan" ("id","name","slug","price","maxLines","maxUsers","maxConversationsPerMonth","trialDays","aiEnabled","isActive","createdAt","updatedAt")
VALUES
  (gen_random_uuid(), 'Trial',      'trial',      0,   1,  2,    200,  15, true, true, NOW(), NOW()),
  (gen_random_uuid(), 'Starter',    'starter',    29,  1,  5,   1000,   0, true, true, NOW(), NOW()),
  (gen_random_uuid(), 'Pro',        'pro',        79,  3, 15,   5000,   0, true, true, NOW(), NOW()),
  (gen_random_uuid(), 'Enterprise', 'enterprise', 199, 10, -1,   -1,    0, true, true, NOW(), NOW())
ON CONFLICT (slug) DO NOTHING;
