import { PrismaClient } from '@prisma/client';
import type { ICalendarService, AIToolDef, Appointment } from '@boti/core';

const DEFAULT_SLOT_DURATION = 60; // minutes
const WORK_HOURS_START = 8;
const WORK_HOURS_END = 19; // slots can end up to 19:00 (e.g. 18:00-19:00 or 17:30-18:30)
const TZ_OFFSET = '-04:00'; // America/Asuncion (Paraguay, no DST)

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
    // Today's date in Paraguay local time (UTC-4)
    const todayPY = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const today = todayPY.toISOString().slice(0, 10); // YYYY-MM-DD
    return [
      {
        name: 'check_availability',
        description:
          `Consulta los horarios disponibles para agendar una cita en una fecha específica. ` +
          `Úsala cuando el cliente quiera saber qué horarios hay disponibles. ` +
          `Hoy es ${today}. Cuando el cliente diga "el jueves 30" o similar sin especificar mes, ` +
          `inferí el mes correcto a partir de la fecha de hoy.`,
        parameters: {
          type: 'object',
          properties: {
            fecha: {
              type: 'string',
              description: 'Fecha en formato YYYY-MM-DD (ej: 2026-04-30). Siempre incluí el año correcto.',
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
          `Agenda una cita para el cliente en el calendario. ` +
          `Úsala cuando el cliente haya confirmado la fecha y hora que desea. ` +
          `Si el cliente insiste en un horario específico que no aparece en check_availability, ` +
          `igual podés crearlo — check_availability solo muestra slots sugeridos, ` +
          `pero create_appointment acepta cualquier hora. ` +
          `Hoy es ${today}. Siempre usá el año correcto en fecha_hora.`,
        parameters: {
          type: 'object',
          properties: {
            titulo: {
              type: 'string',
              description: 'Título o motivo de la cita',
            },
            fecha_hora: {
              type: 'string',
              description: 'Fecha y hora de inicio en formato ISO 8601 (ej: 2026-04-30T17:30:00). Siempre incluí el año correcto.',
            },
            duracion_minutos: {
              type: 'number',
              description: 'Duración de la cita en minutos (por defecto 60)',
            },
            notas: {
              type: 'string',
              description: 'Resumen del motivo de la reunión y contexto relevante de la conversación. Siempre incluilo aunque sea breve.',
            },
          },
          required: ['titulo', 'fecha_hora'],
        },
      },
      {
        name: 'reschedule_appointment',
        description:
          `Reagenda una cita: cancela las citas pendientes del cliente y crea una nueva en el horario indicado. ` +
          `Úsala cuando el cliente pida cambiar, mover o reagendar su cita. ` +
          `Hoy es ${today}. Siempre usá el año correcto.`,
        parameters: {
          type: 'object',
          properties: {
            nueva_fecha_hora: {
              type: 'string',
              description: 'Nueva fecha y hora en formato ISO 8601 (ej: 2026-05-01T17:00:00). Siempre incluí el año correcto.',
            },
            titulo: {
              type: 'string',
              description: 'Título de la cita (opcional — si no se especifica, mantiene el de la cita anterior)',
            },
            duracion_minutos: {
              type: 'number',
              description: 'Duración en minutos (por defecto 60)',
            },
            notas: {
              type: 'string',
              description: 'Contexto y motivo de la cita. Incluilo siempre.',
            },
          },
          required: ['nueva_fecha_hora'],
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
    if (toolName === 'reschedule_appointment') {
      return this.rescheduleAppointment(lineId, clientPhone, clientName, args);
    }
    return `Herramienta "${toolName}" no disponible.`;
  }

  // ─── Private helpers ────────────────────────────────────────────────

  private async checkAvailability(lineId: string, fecha: string, durationMin: number): Promise<string> {
    if (!fecha) return 'Por favor indica la fecha (formato YYYY-MM-DD).';

    // Parse in Paraguay timezone so day boundaries are correct.
    const date = new Date(fecha + 'T00:00:00' + TZ_OFFSET);
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

    // If no timezone offset in the string, assume Paraguay local time.
    const hasOffset = /[+-]\d{2}:\d{2}$|Z$/.test(fechaHora);
    const startAt = new Date(hasOffset ? fechaHora : fechaHora + TZ_OFFSET);
    if (isNaN(startAt.getTime())) return 'Fecha y hora inválida. Usa formato ISO 8601 (ej: 2026-04-30T17:00:00).';

    // Validate date is not unreasonably far in the future
    const todayPY = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const maxDate = new Date(todayPY.getTime() + 90 * 24 * 60 * 60 * 1000);
    if (startAt > maxDate) {
      const todayStr = todayPY.toISOString().slice(0, 10);
      return `La fecha ${fechaHora.slice(0, 10)} parece muy lejana. Hoy es ${todayStr}. ¿Quisiste decir otro mes? Verificá la fecha y volvé a intentarlo.`;
    }

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

  private async rescheduleAppointment(
    lineId: string,
    clientPhone: string,
    clientName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const nuevaFechaHora = String(args.nueva_fecha_hora ?? '');
    const durationMin = Number(args.duracion_minutos ?? DEFAULT_SLOT_DURATION);
    const titulo = args.titulo ? String(args.titulo) : undefined;
    const notas = args.notas ? String(args.notas) : undefined;

    const hasOffset = /[+-]\d{2}:\d{2}$|Z$/.test(nuevaFechaHora);
    const newStart = new Date(hasOffset ? nuevaFechaHora : nuevaFechaHora + TZ_OFFSET);
    if (isNaN(newStart.getTime())) {
      return 'Fecha y hora inválida. Usá formato ISO 8601 (ej: 2026-05-01T17:00:00).';
    }

    // Date validation: max 90 days
    const todayPY = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const maxDate = new Date(todayPY.getTime() + 90 * 24 * 60 * 60 * 1000);
    if (newStart > maxDate) {
      const todayStr = todayPY.toISOString().slice(0, 10);
      return `La fecha parece muy lejana. Hoy es ${todayStr}. ¿Quisiste decir otro mes? Verificá la fecha y volvé a intentarlo.`;
    }

    const newEnd = new Date(newStart.getTime() + durationMin * 60 * 1000);

    // Find existing upcoming appointments for this client
    const existing = await this.prisma.appointment.findMany({
      where: {
        lineId,
        clientPhone,
        status: 'SCHEDULED',
        startAt: { gte: new Date() },
      },
      orderBy: { startAt: 'asc' },
    });

    const finalTitle = titulo ?? (existing[0]?.title ?? 'Cita');

    // Check conflict with OTHER appointments (not this client's)
    const existingIds = existing.map(a => a.id);
    const conflict = await this.prisma.appointment.findFirst({
      where: {
        lineId,
        status: { not: 'CANCELLED' },
        ...(existingIds.length > 0 ? { id: { notIn: existingIds } } : {}),
        OR: [{ startAt: { lt: newEnd }, endAt: { gt: newStart } }],
      },
    });
    if (conflict) {
      return `Ese horario ya está ocupado (${conflict.title}). Por favor elegí otro horario.`;
    }

    // Cancel existing
    if (existingIds.length > 0) {
      await this.prisma.appointment.updateMany({
        where: { id: { in: existingIds } },
        data: { status: 'CANCELLED' },
      });
    }

    // Create new
    await this.prisma.appointment.create({
      data: {
        lineId,
        clientPhone,
        clientName: clientName || clientPhone,
        title: finalTitle,
        notes: notas ?? null,
        startAt: newStart,
        endAt: newEnd,
        googleEventId: null,
        status: 'SCHEDULED',
      },
    });

    const dateStr = newStart.toLocaleDateString('es-PY', { weekday: 'long', day: 'numeric', month: 'long' });
    const timeStr = newStart.toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });

    const cancelMsg = existingIds.length > 0
      ? ` (${existingIds.length} cita${existingIds.length > 1 ? 's anteriores canceladas' : ' anterior cancelada'})`
      : '';
    return `Cita reagendada exitosamente: "${finalTitle}" el ${dateStr} a las ${timeStr} (${durationMin} min)${cancelMsg}.`;
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
