-- AlterTable: add receptor nombre and email to SaleRecord
ALTER TABLE "SaleRecord" ADD COLUMN "receptorNombre" TEXT,
                         ADD COLUMN "receptorEmail"  TEXT;
