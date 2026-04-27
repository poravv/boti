CREATE TABLE IF NOT EXISTS "SystemConfig" (
  "key"       TEXT NOT NULL,
  "value"     TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);
