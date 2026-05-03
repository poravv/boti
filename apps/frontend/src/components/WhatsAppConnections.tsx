import { useEffect, useState } from 'react';
import { apiFetch, apiFetchJson } from '../lib/apiClient';
import { QRCodeSVG } from 'qrcode.react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormInput,
  Icon,
  Modal,
  SkeletonCard,
  cn,
  useToast,
} from './ui';

interface WhatsAppLine {
  id: string;
  name: string;
  phone: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'QR_PENDING';
  qrCode?: string;
}

const STATUS_BADGE_VARIANT: Record<WhatsAppLine['status'], 'success' | 'warning' | 'danger' | 'neutral'> = {
  CONNECTED: 'success',
  QR_PENDING: 'warning',
  CONNECTING: 'warning',
  DISCONNECTED: 'neutral',
};

const STATUS_LABEL: Record<WhatsAppLine['status'], string> = {
  CONNECTED: 'Conectado',
  QR_PENDING: 'QR pendiente',
  CONNECTING: 'Conectando...',
  DISCONNECTED: 'Desconectado',
};

const WhatsAppConnections = () => {
  const [lines, setLines] = useState<WhatsAppLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [activeQrLine, setActiveQrLine] = useState<string | null>(null);
  const [currentQr, setCurrentQr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const fetchLines = async () => {
    try {
      const data = await apiFetchJson<{ lines: WhatsAppLine[] }>('/api/lines');
      setLines(data.lines || []);
    } catch (err) {
      console.error('Error fetching lines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLines();
  }, []);

  useEffect(() => {
    const handleWSEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ event: string; data?: Record<string, unknown> }>).detail;
      if (!detail || detail.event !== 'line:status') return;
      const data = (detail.data || {}) as { lineId?: string; status?: WhatsAppLine['status']; qrCode?: string };
      if (!data.lineId) return;
      setLines((prev) =>
        prev.map((line) =>
          line.id === data.lineId
            ? { ...line, status: data.status ?? line.status, qrCode: data.qrCode }
            : line,
        ),
      );
    };

    window.addEventListener('boti:ws-event', handleWSEvent);
    return () => window.removeEventListener('boti:ws-event', handleWSEvent);
  }, []);

  useEffect(() => {
    if (!activeQrLine) return;
    const activeLine = lines.find((line) => line.id === activeQrLine);
    if (activeLine?.qrCode) {
      setCurrentQr(activeLine.qrCode);
    }
    if (activeLine?.status === 'CONNECTED') {
      setActiveQrLine(null);
      setCurrentQr(null);
      toast.show('Línea conectada correctamente.', { variant: 'success' });
    }
  }, [lines, activeQrLine, toast]);

  const handleAddLine = async (existingId?: string) => {
    if (!existingId && !newLineName.trim()) return;
    const lineId = existingId || newLineName.toLowerCase().replace(/\s+/g, '-');
    setSubmitting(true);

    try {
      const data = await apiFetchJson<{ qrCode?: string }>(`/api/lines/${lineId}/connect`, { method: 'POST' });
      setActiveQrLine(lineId);
      setCurrentQr(data.qrCode ?? null);
      setShowAddLine(false);
      setNewLineName('');
      fetchLines();
    } catch (err) {
      console.error('Error adding/reconnecting line:', err);
      toast.show('No se pudo iniciar la vinculación.', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await apiFetch(`/api/lines/${id}/disconnect`, { method: 'POST' });
      fetchLines();
      toast.show('Línea desconectada.', { variant: 'info' });
    } catch (err) {
      console.error('Error disconnecting:', err);
      toast.show('Error al desconectar la línea.', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta línea permanentemente? Esta acción no se puede deshacer.')) return;
    try {
      await apiFetch(`/api/lines/${id}`, { method: 'DELETE' });
      fetchLines();
      toast.show('Línea eliminada.', { variant: 'success' });
    } catch (err) {
      console.error('Error deleting line:', err);
      toast.show('Error al eliminar la línea.', { variant: 'error' });
    }
  };

  const connectedCount = lines.filter((line) => line.status === 'CONNECTED').length;

  return (
    <section className="space-y-6">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-lg font-bold text-on-surface">Conexiones WhatsApp</h1>
            <p className="text-on-surface-variant text-body mt-1">Gestiona tus líneas de WhatsApp Business</p>
          </div>
          <Button variant="primary" onClick={() => setShowAddLine(true)} leadingIcon="add">
            Nueva línea
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Card
          variant="glass-elevated"
          padding="lg"
          className="lg:col-span-8 flex flex-col md:flex-row gap-6 md:gap-8 animate-fade-in-up"
        >
          <div className="flex-1 space-y-5">
            <div>
              <h2 className="text-heading-md text-action">Vincular dispositivo</h2>
              <p className="text-body-sm text-on-surface-variant mt-2">
                {activeQrLine
                  ? `Vinculando: ${activeQrLine}`
                  : 'Escanea el código QR para autorizar a Boti como un dispositivo vinculado.'}
              </p>
            </div>

            <ol className="space-y-3">
              {[
                'Abre WhatsApp en tu teléfono',
                'Ve a Ajustes > Dispositivos Vinculados',
                'Escanea el código QR que aparece a la derecha',
              ].map((step, index) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="w-7 h-7 bg-secondary/10 text-secondary rounded-full flex items-center justify-center text-caption font-semibold flex-shrink-0">
                    {index + 1}
                  </span>
                  <p className="text-body-sm text-on-surface-variant">{step}</p>
                </li>
              ))}
            </ol>

            {activeQrLine && (
              <Button
                variant="secondary"
                size="sm"
                leadingIcon="close"
                onClick={() => {
                  setActiveQrLine(null);
                  setCurrentQr(null);
                }}
              >
                Cancelar
              </Button>
            )}
          </div>

          <div className="w-full md:w-64 aspect-square rounded-2xl border-2 border-dashed border-secondary/30 flex items-center justify-center relative overflow-hidden bg-white p-4">
            {activeQrLine && currentQr ? (
              <div className="p-4 bg-white rounded-xl shadow-glass-sm">
                <QRCodeSVG value={currentQr} size={200} />
              </div>
            ) : (
              <div className="text-center opacity-50 space-y-2">
                <Icon name="qr_code_2" size="xl" className="text-secondary" />
                <p className="text-overline uppercase text-on-surface-variant">Esperando…</p>
              </div>
            )}
            {activeQrLine && !currentQr && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
                <p className="text-overline uppercase text-secondary">Generando QR</p>
              </div>
            )}
          </div>
        </Card>

        <div className="lg:col-span-4 flex flex-col gap-6">
          <Card
            variant="glass-elevated"
            padding="lg"
            className="flex-1 relative overflow-hidden animate-fade-in-up"
            style={{ animationDelay: '60ms' }}
          >
            <div
              aria-hidden="true"
              className="absolute top-0 right-0 w-24 h-24 bg-success/10 rounded-full -mr-8 -mt-8 pointer-events-none"
            />
            <div className="relative flex flex-col gap-3">
              <span className="text-overline uppercase text-on-surface-variant">Estado del sistema</span>
              <div className="flex items-center justify-between">
                <span className="text-display-sm text-action">{connectedCount}</span>
                <Icon name="hub" size="xl" className="text-success" filled />
              </div>
              <p className="text-caption text-on-surface-variant">
                Líneas activas procesando interacciones en tiempo real.
              </p>
            </div>
          </Card>
          <Card
            variant="glass-elevated"
            padding="lg"
            className="flex-1 animate-fade-in-up"
            style={{ animationDelay: '120ms' }}
          >
            <div className="flex flex-col gap-3">
              <span className="text-overline uppercase text-on-surface-variant">
                Disponibilidad promedio
              </span>
              <span className="text-heading-md text-action">99.8%</span>
              <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full"
                  style={{ width: '99.8%' }}
                />
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-12 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-heading-sm text-action">Números conectados</h3>
            <Badge variant="neutral" size="sm">
              {lines.length} / 5
            </Badge>
          </div>

          {loading && lines.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 2 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : lines.length === 0 ? (
            <Card variant="glass" padding="lg" className="border-dashed">
              <EmptyState
                icon="link"
                title="Sin líneas configuradas"
                description="Agrega tu primera línea de WhatsApp Business para comenzar"
                action={
                  <Button
                    variant="primary"
                    size="md"
                    leadingIcon="add"
                    onClick={() => setShowAddLine(true)}
                  >
                    Nueva línea
                  </Button>
                }
              />
            </Card>
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lines.map((line, index) => (
                <li
                  key={line.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                >
                  <Card
                    variant="glass"
                    interactive
                    padding="md"
                    className="flex items-center justify-between gap-4 relative overflow-hidden"
                  >
                    <div
                      aria-hidden="true"
                      className={cn(
                        'absolute inset-0 opacity-[0.04] pointer-events-none',
                        line.status === 'CONNECTED' && 'bg-success',
                        line.status === 'QR_PENDING' && 'bg-warning',
                        line.status === 'CONNECTING' && 'bg-info',
                        line.status === 'DISCONNECTED' && 'bg-error',
                      )}
                    />

                    <div className="flex items-center gap-4 relative min-w-0">
                      <div
                        className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center',
                          line.status === 'CONNECTED' && 'bg-success-container text-on-success-container',
                          line.status === 'QR_PENDING' && 'bg-warning-container text-on-warning-container',
                          line.status === 'CONNECTING' && 'bg-info-container text-on-info-container',
                          line.status === 'DISCONNECTED' && 'bg-error-container text-on-error-container',
                        )}
                      >
                        <Icon name="smartphone" size="lg" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-body font-semibold text-on-surface truncate">
                            {line.name}
                          </h4>
                          {line.status === 'CONNECTED' && <Badge variant="success" dot />}
                        </div>
                        <p className="text-caption text-on-surface-variant font-mono truncate">
                          {line.status === 'CONNECTED'
                            ? line.phone || 'Sesión activa'
                            : 'Listo para vincular'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 relative flex-shrink-0">
                      <Badge variant={STATUS_BADGE_VARIANT[line.status]} size="sm" className="hidden sm:inline-flex">
                        {STATUS_LABEL[line.status]}
                      </Badge>

                      {line.status !== 'CONNECTED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leadingIcon="qr_code"
                          onClick={() => {
                            setActiveQrLine(line.id);
                            handleAddLine(line.id);
                          }}
                        >
                          Reconectar
                        </Button>
                      )}

                      <Button
                        variant="icon"
                        size="sm"
                        aria-label="Desvincular línea"
                        onClick={() => handleDisconnect(line.id)}
                        className="text-on-surface-variant hover:text-error hover:bg-error/5"
                      >
                        <Icon name="link_off" size="sm" />
                      </Button>

                      <Button
                        variant="icon"
                        size="sm"
                        aria-label="Eliminar línea permanentemente"
                        onClick={() => handleDelete(line.id)}
                        className="text-error hover:bg-error/10"
                      >
                        <Icon name="delete" size="sm" />
                      </Button>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal
        open={showAddLine}
        onClose={() => setShowAddLine(false)}
        size="sm"
        title="Nueva línea de WhatsApp"
        description="Asigná un nombre interno para identificar esta línea."
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setShowAddLine(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={submitting}
              disabled={!newLineName.trim()}
              onClick={() => handleAddLine()}
            >
              Crear y vincular
            </Button>
          </>
        }
      >
        <FormInput
          label="Nombre amistoso"
          floatingLabel
          value={newLineName}
          onChange={(event) => setNewLineName(event.target.value)}
          autoFocus
        />
      </Modal>
    </section>
  );
};

export default WhatsAppConnections;
