-- Migration: add_external_api
-- Creates ExternalApi table with a cascade-delete relation to WhatsAppLine

CREATE TABLE "ExternalApi" (
    "id"        TEXT NOT NULL,
    "lineId"    TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "baseUrl"   TEXT NOT NULL,
    "method"    TEXT NOT NULL DEFAULT 'GET',
    "headers"   JSONB NOT NULL DEFAULT '{}',
    "body"      TEXT,
    "outputKey" TEXT,
    "username"  TEXT,
    "password"  TEXT,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalApi_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ExternalApi" ADD CONSTRAINT "ExternalApi_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "WhatsAppLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
