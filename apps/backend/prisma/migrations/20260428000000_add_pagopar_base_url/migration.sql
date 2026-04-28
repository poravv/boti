-- Migration: add_pagopar_base_url
-- Adds optional baseUrl to PagoParConfig so each client can override the PagoPar API endpoint

ALTER TABLE "PagoParConfig" ADD COLUMN IF NOT EXISTS "baseUrl" TEXT;
