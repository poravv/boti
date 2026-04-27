-- Fix plan definitions: remove enterprise, rename starter→basico,
-- correct prices (Guaraníes), limits and trial days.

-- Remove obsolete plans
DELETE FROM "Plan" WHERE "slug" IN ('enterprise', 'starter');

-- Trial: keep 1 line, 2 users, 100 conv, 15 trial days, price 0
INSERT INTO "Plan" ("id","name","slug","price","maxLines","maxUsers","maxConversationsPerMonth","trialDays","aiEnabled","isActive","createdAt","updatedAt")
VALUES (gen_random_uuid(), 'Trial', 'trial', 0, 1, 2, 100, 15, true, true, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET
  "name"="excluded"."name", "price"="excluded"."price",
  "maxLines"="excluded"."maxLines", "maxUsers"="excluded"."maxUsers",
  "maxConversationsPerMonth"="excluded"."maxConversationsPerMonth",
  "trialDays"="excluded"."trialDays", "updatedAt"=NOW();

-- Básico: 1 line, 5 users, 500 conv, Gs. 150.000
INSERT INTO "Plan" ("id","name","slug","price","maxLines","maxUsers","maxConversationsPerMonth","trialDays","aiEnabled","isActive","createdAt","updatedAt")
VALUES (gen_random_uuid(), 'Básico', 'basico', 150000, 1, 5, 500, 0, true, true, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET
  "name"="excluded"."name", "price"="excluded"."price",
  "maxLines"="excluded"."maxLines", "maxUsers"="excluded"."maxUsers",
  "maxConversationsPerMonth"="excluded"."maxConversationsPerMonth",
  "trialDays"="excluded"."trialDays", "updatedAt"=NOW();

-- Pro: 3 lines, 10 users, unlimited conv (-1), Gs. 350.000
INSERT INTO "Plan" ("id","name","slug","price","maxLines","maxUsers","maxConversationsPerMonth","trialDays","aiEnabled","isActive","createdAt","updatedAt")
VALUES (gen_random_uuid(), 'Pro', 'pro', 350000, 3, 10, -1, 0, true, true, NOW(), NOW())
ON CONFLICT (slug) DO UPDATE SET
  "name"="excluded"."name", "price"="excluded"."price",
  "maxLines"="excluded"."maxLines", "maxUsers"="excluded"."maxUsers",
  "maxConversationsPerMonth"="excluded"."maxConversationsPerMonth",
  "trialDays"="excluded"."trialDays", "updatedAt"=NOW();
