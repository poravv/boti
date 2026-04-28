import { useEffect, useState, useCallback } from 'react';
import { apiFetchJson, apiFetch } from '../../lib/apiClient';
import { Button, Card, FormSelect, Icon, useToast, EmptyState } from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Line {
  id: string;
  name: string;
  status: string;
}

interface Appointment {
  id: string;
  lineId: string;
  clientPhone?: string;
  clientName?: string;
  title: string;
  notes?: string;
  startAt: string;
  endAt: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month, 1);
  while (d.getMonth() === month) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('es-PY', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatDateFull(iso: string) {
  return new Date(iso).toLocaleDateString('es-PY', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

const WEEKDAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// ─── Detail Modal ─────────────────────────────────────────────────────────────

function AppointmentDetailModal({ appt, onClose, onCancel }: {
  appt: Appointment;
  onClose: () => void;
  onCancel: (id: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const durationMin = Math.round(
    (new Date(appt.endAt).getTime() - new Date(appt.startAt).getTime()) / 60000
  );

  const statusLabel = appt.status === 'SCHEDULED'
    ? 'Programada'
    : appt.status === 'CANCELLED'
      ? 'Cancelada'
      : appt.status === 'COMPLETED'
        ? 'Completada'
        : appt.status;

  const statusClass = appt.status === 'SCHEDULED'
    ? 'bg-primary/10 text-primary'
    : appt.status === 'CANCELLED'
      ? 'bg-destructive/10 text-destructive'
      : 'bg-muted text-muted-foreground';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-border">
          <div className="flex items-start gap-3 min-w-0">
            <Icon name="event" size="md" className="text-primary shrink-0 mt-0.5" />
            <h2 className="font-semibold text-foreground text-base leading-snug">{appt.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 mt-0.5"
            aria-label="Cerrar"
          >
            <Icon name="close" size="sm" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Date / time */}
          <div className="flex items-start gap-3">
            <Icon name="schedule" size="sm" className="text-muted-foreground shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground capitalize">{formatDateFull(appt.startAt)}</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {formatTime(appt.startAt)} – {formatTime(appt.endAt)}
                <span className="ml-2 text-xs">({durationMin} min)</span>
              </p>
            </div>
          </div>

          {/* Client */}
          {(appt.clientName || appt.clientPhone) && (
            <div className="flex items-start gap-3">
              <Icon name="person" size="sm" className="text-muted-foreground shrink-0 mt-0.5" />
              <div>
                {appt.clientName && (
                  <p className="text-sm font-medium text-foreground">{appt.clientName}</p>
                )}
                {appt.clientPhone && (
                  <p className="text-sm text-muted-foreground mt-0.5">{appt.clientPhone}</p>
                )}
              </div>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-3">
            <Icon name="info" size="sm" className="text-muted-foreground shrink-0" />
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusClass}`}>
              {statusLabel}
            </span>
          </div>

          {/* Notes */}
          {appt.notes ? (
            <div className="flex items-start gap-3">
              <Icon name="notes" size="sm" className="text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{appt.notes}</p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Icon name="notes" size="sm" className="text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground italic">Sin notas</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 pb-5">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cerrar
          </Button>
          {appt.status === 'SCHEDULED' && (
            <button
              onClick={() => { onCancel(appt.id); onClose(); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
            >
              <Icon name="cancel" size="xs" />
              Cancelar cita
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CalendarPage() {
  const toast = useToast();

  const [lines, setLines] = useState<Line[]>([]);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [detailAppointment, setDetailAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(false);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    apiFetchJson<{ lines: Line[] }>('/api/lines').then(d => {
      setLines(d.lines);
      if (d.lines.length > 0) setSelectedLineId(d.lines[0].id);
    }).catch(() => {});
  }, []);

  const loadAppointments = useCallback(async (lineId: string) => {
    if (!lineId) return;
    setLoading(true);
    try {
      const from = new Date(viewYear, viewMonth, 1).toISOString();
      const to = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();
      const data = await apiFetchJson<{ appointments: Appointment[] }>(
        `/api/lines/${lineId}/appointments?from=${from}&to=${to}`
      );
      setAppointments(data.appointments);
    } catch {
      toast.show('Error cargando citas.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedLineId) loadAppointments(selectedLineId);
  }, [selectedLineId, viewYear, viewMonth]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async (apptId: string) => {
    if (!selectedLineId) return;
    try {
      await apiFetch(`/api/lines/${selectedLineId}/appointments/${apptId}`, { method: 'DELETE' });
      toast.show('Cita cancelada.', { variant: 'success' });
      setAppointments(prev => prev.filter(a => a.id !== apptId));
    } catch {
      toast.show('Error al cancelar la cita.', { variant: 'error' });
    }
  };

  const days = getDaysInMonth(viewYear, viewMonth);
  const firstDayOfWeek = days[0].getDay();

  const apptsByDay = new Map<string, Appointment[]>();
  for (const a of appointments) {
    const key = new Date(a.startAt).toDateString();
    if (!apptsByDay.has(key)) apptsByDay.set(key, []);
    apptsByDay.get(key)!.push(a);
  }

  const selectedDayAppts = selectedDay
    ? appointments.filter(a => isSameDay(new Date(a.startAt), selectedDay))
    : appointments;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Calendario</h1>
          <p className="text-sm text-muted-foreground mt-1">Citas agendadas por el asistente de IA</p>
        </div>
        {lines.length > 1 && (
          <div className="w-56">
            <FormSelect
              label=""
              value={selectedLineId}
              onChange={(e) => { setSelectedLineId(e.target.value); setSelectedDay(null); }}
            >
              {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </FormSelect>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Month calendar */}
        <div className="lg:col-span-2">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <Button variant="secondary" size="sm" onClick={prevMonth}>
                <Icon name="chevron_left" size="sm" />
              </Button>
              <h2 className="font-semibold text-foreground">
                {MONTHS[viewMonth]} {viewYear}
              </h2>
              <Button variant="secondary" size="sm" onClick={nextMonth}>
                <Icon name="chevron_right" size="sm" />
              </Button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="h-12" />
              ))}
              {days.map(day => {
                const dayAppts = apptsByDay.get(day.toDateString()) ?? [];
                const isToday = isSameDay(day, today);
                const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={[
                      'h-12 rounded-lg flex flex-col items-center justify-start pt-1 text-xs transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : isToday
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted text-foreground',
                    ].join(' ')}
                  >
                    <span className={isToday && !isSelected ? 'font-bold' : 'font-medium'}>{day.getDate()}</span>
                    {dayAppts.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayAppts.slice(0, 3).map((_, i) => (
                          <span
                            key={i}
                            className={`w-1 h-1 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Appointment list */}
        <div>
          <Card className="p-4 h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">
                {selectedDay
                  ? formatDateLabel(selectedDay.toISOString())
                  : `${MONTHS[viewMonth]} — ${appointments.length} cita${appointments.length !== 1 ? 's' : ''}`}
              </h3>
              {selectedDay && (
                <button
                  onClick={() => setSelectedDay(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Ver todo
                </button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : selectedDayAppts.length === 0 ? (
              <EmptyState
                icon="event_available"
                title="Sin citas"
                description={selectedDay ? 'No hay citas para este día.' : 'No hay citas en este mes.'}
              />
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[420px]">
                {selectedDayAppts.map(appt => (
                  <div
                    key={appt.id}
                    className="p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground text-sm truncate">{appt.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateLabel(appt.startAt)} · {formatTime(appt.startAt)} – {formatTime(appt.endAt)}
                        </p>
                        {appt.clientName && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Icon name="person" size="xs" />
                            {appt.clientName}{appt.clientPhone ? ` (${appt.clientPhone})` : ''}
                          </p>
                        )}
                        {appt.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic line-clamp-2">{appt.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setDetailAppointment(appt)}
                          className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                          title="Ver detalle"
                        >
                          <Icon name="visibility" size="sm" />
                        </button>
                        <button
                          onClick={() => handleCancel(appt.id)}
                          className="text-destructive/70 hover:text-destructive transition-colors p-0.5"
                          title="Cancelar cita"
                        >
                          <Icon name="cancel" size="sm" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Icon name="smart_toy" size="md" className="text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-foreground text-sm">Cómo funciona</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cuando el cliente pide agendar una cita en WhatsApp, el asistente usa{' '}
              <code className="bg-muted px-1 rounded text-xs">check_availability</code> para
              consultar horarios libres y{' '}
              <code className="bg-muted px-1 rounded text-xs">create_appointment</code> para
              crear la cita directamente desde la conversación.
            </p>
          </div>
        </div>
      </Card>

      {/* Appointment detail modal */}
      {detailAppointment && (
        <AppointmentDetailModal
          appt={detailAppointment}
          onClose={() => setDetailAppointment(null)}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}
