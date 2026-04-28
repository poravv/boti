-- Add lineId to User for WhatsApp line assignment
ALTER TABLE "User" ADD COLUMN "lineId" TEXT;
ALTER TABLE "User" ADD CONSTRAINT "User_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "WhatsAppLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "User_lineId_idx" ON "User"("lineId");
