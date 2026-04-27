import { PrismaClient } from '@prisma/client';
import type { ICalendarService, AIToolDef, Appointment } from '@boti/core';

const DEFAULT_SLOT_DURATION = 60; // minutes
const WORK_HOURS_START = 8;
const WORK_HOURS_END = 18;

export class CalendarService implements ICalendarService {
  constructor(private readonly prisma: PrismaClient) {}

  async isConnectedForLine(_lineId: string): Promise<boolean> {
    return true; // Local calendar is always available
  }

  async cancelAppointment(lineId: string, appointmentId: string): Promise<void> {
    await this.prisma.appointment.updateMany({
      where: { id: appointmentId, lineId },
      data: { status: 'CANCELLED' },
    });
  }

  async getAppointments(lineId: string, from: Date, to: Date): Promise<Appointment[]> {
    const records = await this.prisma.appointment.findMany({
      where: { lineId, startAt: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      orderBy: { startAt: 'asc' },
    });
    return records.map(r => ({
      id: r.id,
      lineId: r.lineId,
      clientPhone: r.clientPhone,
      clientName: r.clientName,
      title: r.title,
      notes: r.notes,
      startAt: r.startAt,
      endAt: r.endAt,
      googleEventId: null,
      status: r.status,
    }));
  }

  getToolDefinitions(): AIToolDef[] {
    return [
      {
        name: 'check_availability',
        description:
          'Consulta los horarios disponibles para agendar una cita en una fecha específica. ' +
          'Úsala cuando el cliente quiera saber qué horarios hay disponibles.',
        parameters: {
          type: 'object',
          properties: {
            fecha: {
              type: 'string',
              description: 'Fecha en formato YYYY-MM-DD (ej: 2026-04-28)',
            },
            duracion_minutos: {
              type: 'number',
              description: 'Duración de la cita en minutos (por defecto 60)',
            },
          },
          required: ['fecha'],
        },
      },
      {
        name: 'create_appointment',
        description:
          'Agenda una cita para el cliente en el calendario. ' +
          'Úsala SOLO cuando el cliente haya confirmado la fecha y hora que desea.',
        parameters: {
          type: 'object',
          properties: {
            titulo: {
              type: 'string',
              description: 'Título o motivo de la cita',
            },
            fecha_hora: {
              type: 'string',
              description: 'Fecha y hora de inicio en formato ISO 8601 (ej: 2026-04-28T10:00:00)',
            },
            duracion_minutos: {
              type: 'number',
              description: 'Duración de la cita en minutos (por defecto 60)',
            },
            notas: {
              type: 'string',
              description: 'Notas adicionales o descripción de la cita (opcional)',
            },
          },
          required: ['titulo', 'fecha_hora'],
        },
      },
    ];
  }

  async executeTool(
    lineId: string,
    clientPhone: string,
    clientName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (toolName === 'check_availability') {
      return this.checkAvailability(lineId, String(args.fecha ?? ''), Number(args.duracion_minutos ?? DEFAULT_SLOT_DURATION));
    }
    if (toolName === 'create_appointment') {
      return this.createAppointment(lineId, clientPhone, clientName, args);
    }
    return `Herramienta "${toolName}" no disponible.`;
  }

  // ─── Private helpers ────────────────────────────────────────────────

  private async checkAvailability(lineId: string, fecha: string, durationMin: number): Promise<string> {
    if (!fecha) return 'Por favor indica la fecha (formato YYYY-MM-DD).';

    const date = new Date(fecha + 'T00:00:00');
    if (isNaN(date.getTime())) return 'Fecha inválida. Usa el formato YYYY-MM-DD.';

    const dayStart = new Date(date);
    dayStart.setHours(WORK_HOURS_START, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(WORK_HOURS_END, 0, 0, 0);

    const localAppts = await this.prisma.appointment.findMany({
      where: { lineId, startAt: { gte: dayStart, lte: dayEnd }, status: { not: 'CANCELLED' } },
    });
    const busySlots = localAppts.map(a => ({ start: a.startAt, end: a.endAt }));
    const freeSlots = this.computeFreeSlots(dayStart, dayEnd, busySlots, durationMin);

    if (freeSlots.length === 0) {
      return `No hay horarios disponibles el ${fecha} para una cita de ${durationMin} minutos.`;
    }

    const formatted = freeSlots.map(s => {
      const h = s.start.getHours().toString().padStart(2, '0');
      const m = s.start.getMinutes().toString().padStart(2, '0');
      return `${h}:${m}`;
    });

    return `Horarios disponibles el ${fecha}: ${formatted.join(', ')}. ¿Cuál prefieres?`;
  }

  private async createAppointment(
    lineId: string,
    clientPhone: string,
    clientName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const titulo = String(args.titulo ?? 'Cita');
    const fechaHora = String(args.fecha_hora ?? '');
    const durationMin = Number(args.duracion_minutos ?? DEFAULT_SLOT_DURATION);
    const notas = args.notas ? String(args.notas) : undefined;

    const startAt = new Date(fechaHora);
    if (isNaN(startAt.getTime())) return 'Fecha y hora inválida. Usa formato ISO 8601 (ej: 2026-04-28T10:00:00).';

    const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);

    const conflict = await this.prisma.appointment.findFirst({
      where: {
        lineId,
        status: { not: 'CANCELLED' },
        OR: [{ startAt: { lt: endAt }, endAt: { gt: startAt } }],
      },
    });
    if (conflict) {
      return `Ya existe una cita en ese horario (${conflict.title}). Por favor elige otro horario.`;
    }

    await this.prisma.appointment.create({
      data: {
        lineId,
        clientPhone,
        clientName: clientName || clientPhone,
        title: titulo,
        notes: notas ?? null,
        startAt,
        endAt,
        googleEventId: null,
        status: 'SCHEDULED',
      },
    });

    const dateStr = startAt.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = startAt.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

    return `Cita agendada exitosamente: "${titulo}" el ${dateStr} a las ${timeStr} (${durationMin} min).`;
  }

  private computeFreeSlots(
    dayStart: Date,
    dayEnd: Date,
    busySlots: { start: Date; end: Date }[],
    durationMin: number,
  ): { start: Date; end: Date }[] {
    const freeSlots: { start: Date; end: Date }[] = [];
    const stepMs = 30 * 60 * 1000;
    const durationMs = durationMin * 60 * 1000;

    let cursor = dayStart.getTime();
    while (cursor + durationMs <= dayEnd.getTime()) {
      const slotStart = cursor;
      const slotEnd = cursor + durationMs;
      const isBusy = busySlots.some(b => b.start.getTime() < slotEnd && b.end.getTime() > slotStart);
      if (!isBusy) {
        freeSlots.push({ start: new Date(slotStart), end: new Date(slotEnd) });
      }
      cursor += stepMs;
    }
    return freeSlots;
  }
}
