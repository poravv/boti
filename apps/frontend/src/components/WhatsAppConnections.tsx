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

const STATUS_CONFIG = {
  CONNECTED:    { label: 'Conectado',     tone: 'success', icon: 'check_circle' },
  QR_PENDING:   { label: 'QR Pendiente',  tone: 'warning', icon: 'qr_code'      },
  CONNECTING:   { label: 'Enlazando…',    tone: 'primary', icon: 'progress_activity' },
  DISCONNECTED: { label: 'Desconectado',  tone: 'neutral', icon: 'link_off'     },
} as const;

const WhatsAppConnections = () => {
  const [lines,        setLines]        = useState<WhatsAppLine[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showAddLine,  setShowAddLine]  = useState(false);
  const [newLineName,  setNewLineName]  = useState('');
  const [activeQrLine, setActiveQrLine] = useState<string | null>(null);
  const [currentQr,    setCurrentQr]   = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);
  const toast = useToast();

  const fetchLines = async () => {
    try {
      const data = await apiFetchJson<{ lines: WhatsAppLine[] }>('/api/lines');
      setLines(data.lines || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchLines(); }, []);

  // Real-time status updates via WebSocket
  useEffect(() => {
    const handleWSEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || detail.event !== 'line:status') return;
      const { lineId, status, qrCode } = detail.data || {};
      if (!lineId) return;

      setLines(prev => prev.map(l =>
        l.id === lineId ? { ...l, status, ...(qrCode !== undefined && { qrCode }) } : l
      ));

      // Auto-show QR when backend emits it for the active line
      if (status === 'QR_PENDING' && qrCode && lineId === activeQrLine) {
        setCurrentQr(qrCode);
      }
      // Auto-close QR panel when line connects
      if (status === 'CONNECTED' && lineId === activeQrLine) {
        setActiveQrLine(null);
        setCurrentQr(null);
        toast.show('¡Línea conectada exitosamente!', { variant: 'success' });
        fetchLines();
      }
    };
    window.addEventListener('boti:ws-event', handleWSEvent);
    return () => window.removeEventListener('boti:ws-event', handleWSEvent);
  }, [activeQrLine]);

  const handleConnect = async (lineId: string) => {
    if (submitting) return;
    setSubmitting(true);
    setActiveQrLine(lineId);
    setCurrentQr(null);
    try {
      const data = await apiFetchJson<{ qrCode?: string }>(`/api/lines/${lineId}/connect`, { method: 'POST' });
      setCurrentQr(data.qrCode ?? null);
      fetchLines();
    } catch {
      toast.show('Error al iniciar vinculación', { variant: 'error' });
      setActiveQrLine(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (lineId: string) => {
    try {
      await apiFetch(`/api/lines/${lineId}/disconnect`, { method: 'POST' });
      fetchLines();
      if (activeQrLine === lineId) { setActiveQrLine(null); setCurrentQr(null); }
    } catch { toast.show('Error al desconectar', { variant: 'error' }); }
  };

  const connectedCount    = lines.filter(l => l.status === 'CONNECTED').length;
  const disconnectedCount = lines.filter(l => l.status === 'DISCONNECTED').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Canales de WhatsApp</h1>
          <p className="text-muted-foreground mt-1.5 font-medium">
            {loading ? 'Cargando…' : `${connectedCount} conectado${connectedCount !== 1 ? 's' : ''} · ${disconnectedCount} desconectado${disconnectedCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="rounded-2xl font-black tracking-widest text-[10px] shadow-premium"
          onClick={() => setShowAddLine(true)}
        >
          <Icon name="add" size="sm" className="mr-2" /> NUEVA LÍNEA
        </Button>
      </div>

      {/* Main grid — lines first in DOM (mobile-first order) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* ── Lines list — visible first on mobile, right column on desktop ── */}
        <div className="space-y-4 order-1 lg:order-2">
          <Card variant="solid" padding="none" className="overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-border/50 flex items-center justify-between">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">
                Mis Líneas
              </h4>
              <Button variant="ghost" size="sm" onClick={fetchLines}>
                <Icon name="refresh" size="xs" />
              </Button>
            </div>

            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />)}
              </div>
            ) : lines.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="Sin líneas configuradas"
                  description="Añade tu primera línea de WhatsApp para empezar."
                  icon="smartphone"
                />
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {lines.map((line) => {
                  const cfg = STATUS_CONFIG[line.status] ?? STATUS_CONFIG.DISCONNECTED;
                  const isActive = activeQrLine === line.id;
                  const isConnected = line.status === 'CONNECTED';
                  const isConnecting = line.status === 'CONNECTING' || line.status === 'QR_PENDING';

                  return (
                    <div
                      key={line.id}
                      className={cn(
                        'p-4 flex items-start gap-4 transition-colors',
                        isActive && !isConnected ? 'bg-action/5' : 'hover:bg-muted/30'
                      )}
                    >
                      {/* Status dot + phone icon */}
                      <div className={cn(
                        'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0',
                        isConnected  ? 'bg-success/10 text-success' :
                        isConnecting ? 'bg-warning/10 text-warning' :
                                       'bg-muted text-muted-foreground'
                      )}>
                        <Icon
                          name={isConnecting ? 'progress_activity' : 'smartphone'}
                          size="sm"
                          className={isConnecting ? 'animate-spin' : ''}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-foreground truncate">{line.name}</p>
                          <Badge variant={cfg.tone} size="sm">{cfg.label}</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {line.phone || 'Sin número'}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-3 mt-2">
                          {!isConnected && !isConnecting && (
                            <button
                              onClick={() => handleConnect(line.id)}
                              disabled={submitting}
                              className="text-[11px] font-black text-action hover:text-action/80 hover:underline transition-colors disabled:opacity-40 flex items-center gap-1"
                            >
                              <Icon name="qr_code" size="xs" />
                              {line.status === 'DISCONNECTED' ? 'RECONECTAR' : 'ENLAZAR'}
                            </button>
                          )}
                          {isConnected && (
                            <button
                              onClick={() => handleDisconnect(line.id)}
                              className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors"
                            >
                              Desconectar
                            </button>
                          )}
                          {isConnecting && isActive && (
                            <span className="text-[11px] text-warning font-medium">Esperando escaneo…</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* System health */}
          <Card variant="solid" className="bg-success/5 border-success/20">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-success/15 text-success flex items-center justify-center">
                <Icon name="check_circle" size="sm" />
              </div>
              <h4 className="font-black uppercase tracking-widest text-xs text-success">Sistema Operativo</h4>
            </div>
            <p className="text-[11px] font-medium text-muted-foreground leading-relaxed">
              Protocolo WhatsApp Web activo · Encriptado de extremo a extremo.
            </p>
          </Card>
        </div>

        {/* ── QR Wizard — second on mobile, left 2/3 on desktop ── */}
        <Card
          variant="solid"
          className="lg:col-span-2 order-2 lg:order-1 relative overflow-hidden flex flex-col justify-center items-center p-10 min-h-[420px]"
        >
          {activeQrLine && currentQr ? (
            <div className="flex flex-col items-center space-y-8 animate-in zoom-in duration-500 relative z-10">
              <div className="text-center space-y-1.5">
                <h3 className="text-xl font-black text-foreground tracking-tight">Escanea para Conectar</h3>
                <p className="text-sm text-muted-foreground">Abre WhatsApp → Dispositivos vinculados → Escanear QR</p>
              </div>

              <div className="p-6 bg-white rounded-3xl shadow-glass-xl border border-border/30">
                <QRCodeSVG value={currentQr} size={220} level="H" />
              </div>

              <div className="flex items-center gap-8 text-center">
                {['Abre WhatsApp', 'Dispositivos vinculados', 'Escanea el QR'].map((step, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="w-7 h-7 rounded-full bg-action/15 text-action text-[11px] font-black flex items-center justify-center mx-auto">
                      {i + 1}
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest max-w-[80px]">{step}</p>
                  </div>
                ))}
              </div>

              <Button variant="ghost" size="sm" onClick={() => { setActiveQrLine(null); setCurrentQr(null); }}>
                <Icon name="close" size="xs" className="mr-1.5" /> Cancelar
              </Button>
            </div>
          ) : activeQrLine && !currentQr ? (
            // Connecting state — waiting for QR
            <div className="flex flex-col items-center gap-6 relative z-10">
              <div className="w-16 h-16 border-4 border-action/20 border-t-action rounded-full animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-bold text-foreground">Generando código QR…</h3>
                <p className="text-sm text-muted-foreground mt-1">Esto puede tardar unos segundos.</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveQrLine(null)}>Cancelar</Button>
            </div>
          ) : (
            // Idle — prompt to select a line
            <div className="flex flex-col items-center text-center space-y-5 max-w-sm relative z-10">
              <div className="w-20 h-20 bg-muted/50 rounded-3xl flex items-center justify-center">
                <Icon name="qr_code" size="xl" className="text-muted-foreground/30" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Listo para conectar</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  Selecciona una línea de la lista{' '}
                  <span className="lg:hidden">de arriba</span>
                  <span className="hidden lg:inline">de la derecha</span>
                  {' '}y presiona <strong className="text-action">RECONECTAR</strong> para generar el código QR.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                <Badge variant="neutral" dot>Seguro</Badge>
                <Badge variant="neutral" dot>Encriptado</Badge>
                <Badge variant="neutral" dot>Multidispositivo</Badge>
              </div>
            </div>
          )}

          {/* Decorative mesh */}
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />
        </Card>
      </div>

      {/* Add line modal */}
      <Modal open={showAddLine} onClose={() => setShowAddLine(false)} title="Agregar Nueva Línea" size="sm">
        <div className="space-y-6">
          <FormInput
            label="NOMBRE DE LA LÍNEA"
            placeholder="Ej: Ventas Paraguay"
            value={newLineName}
            onChange={(e) => setNewLineName(e.target.value)}
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!newLineName.trim() || submitting}
            onClick={async () => {
              const id = newLineName.toLowerCase().replace(/\s+/g, '-');
              try {
                const data = await apiFetchJson<{ qrCode?: string }>(`/api/lines/${id}/connect`, { method: 'POST' });
                setActiveQrLine(id);
                setCurrentQr(data.qrCode ?? null);
                fetchLines();
                setShowAddLine(false);
                setNewLineName('');
              } catch { toast.show('Error al crear la línea', { variant: 'error' }); }
            }}
          >
            CREAR Y CONECTAR LÍNEA
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default WhatsAppConnections;
