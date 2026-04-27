-- Migration: add_autonomous_sales
-- Adds autonomous sales toggle, PagoPar config, Facturador config, and SaleRecord

-- autonomousSalesEnabled toggle on WhatsAppLine
ALTER TABLE "WhatsAppLine" ADD COLUMN IF NOT EXISTS "autonomousSalesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- PagoPar config (one-to-one per line)
CREATE TABLE IF NOT EXISTS "PagoParConfig" (
    "id"          TEXT NOT NULL,
    "lineId"      TEXT NOT NULL,
    "publicKey"   TEXT NOT NULL,
    "privateKey"  TEXT NOT NULL,
    "sandboxMode" BOOLEAN NOT NULL DEFAULT true,
    "callbackUrl" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PagoParConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PagoParConfig_lineId_key" ON "PagoParConfig"("lineId");

ALTER TABLE "PagoParConfig" DROP CONSTRAINT IF EXISTS "PagoParConfig_lineId_fkey";
ALTER TABLE "PagoParConfig"
    ADD CONSTRAINT "PagoParConfig_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "WhatsAppLine"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Facturador config (one-to-one per line)
CREATE TABLE IF NOT EXISTS "FacturadorConfig" (
    "id"             TEXT NOT NULL,
    "lineId"         TEXT NOT NULL,
    "baseUrl"        TEXT NOT NULL,
    "accessKey"      TEXT NOT NULL,
    "secretKey"      TEXT NOT NULL,
    "apiKey"         TEXT,
    "bodyTemplate"   JSONB NOT NULL,
    "successExample" JSONB,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacturadorConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FacturadorConfig_lineId_key" ON "FacturadorConfig"("lineId");

ALTER TABLE "FacturadorConfig" DROP CONSTRAINT IF EXISTS "FacturadorConfig_lineId_fkey";
ALTER TABLE "FacturadorConfig"
    ADD CONSTRAINT "FacturadorConfig_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "WhatsAppLine"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Sale records
CREATE TABLE IF NOT EXISTS "SaleRecord" (
    "id"             TEXT NOT NULL,
    "lineId"         TEXT NOT NULL,
    "clientPhone"    TEXT NOT NULL,
    "hashPedido"     TEXT,
    "pagoParOrderId" TEXT,
    "paymentLinkUrl" TEXT,
    "amount"         INTEGER NOT NULL,
    "currency"       TEXT NOT NULL DEFAULT 'PYG',
    "status"         TEXT NOT NULL DEFAULT 'PENDING',
    "items"          JSONB NOT NULL,
    "invoiceId"      TEXT,
    "paidAt"         TIMESTAMP(3),
    "invoicedAt"     TIMESTAMP(3),
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SaleRecord_lineId_idx"      ON "SaleRecord"("lineId");
CREATE INDEX IF NOT EXISTS "SaleRecord_hashPedido_idx"  ON "SaleRecord"("hashPedido");
CREATE INDEX IF NOT EXISTS "SaleRecord_clientPhone_idx" ON "SaleRecord"("clientPhone");

ALTER TABLE "SaleRecord" DROP CONSTRAINT IF EXISTS "SaleRecord_lineId_fkey";
ALTER TABLE "SaleRecord"
    ADD CONSTRAINT "SaleRecord_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "WhatsAppLine"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
