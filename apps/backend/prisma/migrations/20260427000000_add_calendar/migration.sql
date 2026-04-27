-- Migration: add_calendar
-- Adds CalendarConfig (Google OAuth tokens per line) and Appointment (local + Google sync)

CREATE TABLE IF NOT EXISTS "CalendarConfig" (
    "id"           TEXT NOT NULL,
    "lineId"       TEXT NOT NULL,
    "accessToken"  TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "tokenExpiry"  TIMESTAMP(3),
    "calendarId"   TEXT NOT NULL DEFAULT 'primary',
    "timezone"     TEXT NOT NULL DEFAULT 'America/Asuncion',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CalendarConfig_lineId_key" ON "CalendarConfig"("lineId");

ALTER TABLE "CalendarConfig" DROP CONSTRAINT IF EXISTS "CalendarConfig_lineId_fkey";
ALTER TABLE "CalendarConfig"
    ADD CONSTRAINT "CalendarConfig_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "WhatsAppLine"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Appointments (local store, optionally synced to Google Calendar)
CREATE TABLE IF NOT EXISTS "Appointment" (
    "id"            TEXT NOT NULL,
    "lineId"        TEXT NOT NULL,
    "clientPhone"   TEXT,
    "clientName"    TEXT,
    "title"         TEXT NOT NULL,
    "notes"         TEXT,
    "startAt"       TIMESTAMP(3) NOT NULL,
    "endAt"         TIMESTAMP(3) NOT NULL,
    "googleEventId" TEXT,
    "status"        TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Appointment_lineId_idx" ON "Appointment"("lineId");
CREATE INDEX IF NOT EXISTS "Appointment_startAt_idx" ON "Appointment"("startAt");

ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_lineId_fkey";
ALTER TABLE "Appointment"
    ADD CONSTRAINT "Appointment_lineId_fkey"
    FOREIGN KEY ("lineId") REFERENCES "WhatsAppLine"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
