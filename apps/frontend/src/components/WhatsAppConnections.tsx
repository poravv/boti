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
  CONNECTED: { label: 'Conectado', tone: 'success', icon: 'check_circle' },
  QR_PENDING: { label: 'QR Pendiente', tone: 'warning', icon: 'qr_code' },
  CONNECTING: { label: 'Enlazando...', tone: 'primary', icon: 'sync' },
  DISCONNECTED: { label: 'Desconectado', tone: 'neutral', icon: 'link_off' },
} as const;

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
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchLines(); }, []);

  useEffect(() => {
    const handleWSEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail || detail.event !== 'line:status') return;
      const data = detail.data || {};
      setLines(prev => prev.map(l => l.id === data.lineId ? { ...l, status: data.status, qrCode: data.qrCode } : l));
    };
    window.addEventListener('boti:ws-event', handleWSEvent);
    return () => window.removeEventListener('boti:ws-event', handleWSEvent);
  }, []);

  const handleConnect = async (lineId: string) => {
    setSubmitting(true);
    try {
      const data = await apiFetchJson<{ qrCode?: string }>(`/api/lines/${lineId}/connect`, { method: 'POST' });
      setActiveQrLine(lineId);
      setCurrentQr(data.qrCode ?? null);
      fetchLines();
    } catch { toast.show('Error al iniciar vinculación', { variant: 'error' }); } finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-10">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Canales de WhatsApp</h1>
          <p className="text-muted-foreground mt-2 font-medium">Gestiona tus líneas y la conexión en tiempo real.</p>
        </div>
        <Button variant="primary" size="lg" className="rounded-2xl font-black tracking-widest text-[10px] shadow-premium" onClick={() => setShowAddLine(true)}>
          <Icon name="add" size="sm" className="mr-2" /> NUEVA LÍNEA
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Connection Wizard / QR Display */}
        <Card variant="solid" className="lg:col-span-2 relative overflow-hidden flex flex-col justify-center items-center p-12 min-h-[400px]">
          {activeQrLine && currentQr ? (
            <div className="flex flex-col items-center space-y-8 animate-in zoom-in duration-500">
               <div className="text-center space-y-2">
                  <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Escanea para Conectar</h3>
                  <p className="text-sm text-muted-foreground font-medium">Usa WhatsApp en tu teléfono para escanear el código.</p>
               </div>
               <div className="p-8 bg-white rounded-3xl shadow-glass-xl border border-border/50 relative group">
                  <QRCodeSVG value={currentQr} size={256} level="H" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/90 transition-opacity rounded-3xl backdrop-blur-sm">
                     <Button variant="secondary" size="sm" onClick={() => { setActiveQrLine(null); setCurrentQr(null); }}>
                        <Icon name="close" size="xs" className="mr-2" /> CANCELAR
                     </Button>
                  </div>
               </div>
               <div className="flex gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-2">
                       <div className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-black flex items-center justify-center">{i}</div>
                       <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Paso {i}</span>
                    </div>
                  ))}
               </div>
            </div>
          ) : (
            <div className="text-center space-y-6 max-w-sm">
               <div className="w-20 h-20 bg-muted/50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <Icon name="qr_code" size="xl" className="text-muted-foreground/30" />
               </div>
               <h3 className="text-lg font-bold text-foreground">Configurador de Enlace</h3>
               <p className="text-sm text-muted-foreground font-medium">Selecciona una línea de la lista para generar un nuevo código QR de vinculación.</p>
               <div className="pt-4 flex flex-wrap justify-center gap-2">
                  <Badge variant="neutral" dot>Seguro</Badge>
                  <Badge variant="neutral" dot>Encripado</Badge>
                  <Badge variant="neutral" dot>Multidispositivo</Badge>
               </div>
            </div>
          )}
          {/* Decorative mesh */}
          <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />
        </Card>

        {/* Status Wall Sidebar */}
        <div className="space-y-6">
           <Card variant="solid">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6">Muro de Estado</h4>
              {loading ? (
                <div className="space-y-4">
                   {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-2xl" />)}
                </div>
              ) : lines.length === 0 ? (
                <EmptyState title="Sin líneas" description="Añade tu primera línea para empezar." icon="smartphone" />
              ) : (
                <div className="space-y-3">
                   {lines.map((line) => {
                     const cfg = STATUS_CONFIG[line.status] || STATUS_CONFIG.DISCONNECTED;
                     return (
                       <div key={line.id} className="group p-4 bg-muted/20 hover:bg-white hover:shadow-premium border border-transparent hover:border-border transition-all duration-300 rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-3">
                             <div className={cn(
                               "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                               line.status === 'CONNECTED' ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                             )}>
                                <Icon name="smartphone" size="sm" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-foreground truncate max-w-[120px]">{line.name}</p>
                                <p className="text-[10px] text-muted-foreground font-medium">{line.phone || 'Sin número'}</p>
                             </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                             <Badge variant={cfg.tone} size="sm" className="px-2">{cfg.label}</Badge>
                             {line.status !== 'CONNECTED' && (
                               <button
                                onClick={() => handleConnect(line.id)}
                                disabled={submitting}
                                className="text-[10px] font-black text-primary hover:text-action hover:underline transition-colors disabled:opacity-40"
                               >
                                 {line.status === 'DISCONNECTED' ? 'RECONECTAR' : 'ENLAZAR'}
                               </button>
                             )}
                          </div>
                       </div>
                     );
                   })}
                </div>
              )}
           </Card>

           <Card variant="solid" className="bg-success text-success-foreground border-none">
              <div className="flex items-center gap-3 mb-4">
                 <Icon name="shield_check" size="md" />
                 <h4 className="font-black uppercase tracking-widest text-xs">Salud del Sistema</h4>
              </div>
              <p className="text-[10px] font-bold text-success-foreground/80 leading-relaxed uppercase tracking-wider">
                 Todos los nodos operando con latencia óptima. Protocolo WhatsApp v2.24 activo.
              </p>
           </Card>
        </div>
      </div>

      <Modal open={showAddLine} onClose={() => setShowAddLine(false)} title="Agregar Nueva Línea" size="sm">
         <div className="space-y-6">
            <FormInput 
              label="NOMBRE DE LA LÍNEA"
              placeholder="Ej: Ventas Argentina"
              value={newLineName}
              onChange={(e) => setNewLineName(e.target.value)}
            />
            <Button variant="primary" size="lg" fullWidth disabled={!newLineName.trim()} onClick={async () => {
              const id = newLineName.toLowerCase().replace(/\s+/g, '-');
              await apiFetchJson(`/api/lines/${id}/connect`, { method: 'POST' });
              fetchLines();
              setShowAddLine(false);
              setNewLineName('');
            }}>
               CREAR LÍNEA
            </Button>
         </div>
      </Modal>
    </div>
  );
};

export default WhatsAppConnections;
