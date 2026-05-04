import { useCallback, useEffect, useState } from 'react';
import { apiFetchJson } from '../../lib/apiClient';
import { Badge, Button, Card, FormInput, Icon, useToast, cn } from '../ui';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PagoParFormState {
  baseUrl: string;
  publicKey: string;
  privateKey: string;
  sandboxMode: boolean;
}

interface FacturadorFormState {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  emisorId: string;
  bodyTemplate: string; 
  successExample: string; 
  isActive: boolean;
}

interface SalesConfig {
  autonomousSalesEnabled: boolean;
  pagoParConfig: {
    id: string;
    baseUrl: string | null;
    publicKey: string;
    hasPrivateKey: boolean;
    sandboxMode: boolean;
    callbackUrl: string | null;
  } | null;
  facturadorConfig: {
    id: string;
    baseUrl: string;
    accessKey: string;
    hasSecretKey: boolean;
    apiKey: string | null;
    bodyTemplate: unknown;
    successExample: unknown;
    isActive: boolean;
  } | null;
}

type CommercialStatus = 'ORDER' | 'PAID' | 'INVOICED' | 'ERROR' | 'MEETING' | 'CANCELLED' | string;

interface CommercialEvent {
  id: string;
  kind: 'SALE' | 'APPOINTMENT';
  status: CommercialStatus;
  rawStatus: string;
  sold: boolean;
  clientPhone: string | null;
  clientName: string | null;
  receptorDocumento: string | null;
  receptorNombre: string | null;
  receptorEmail: string | null;
  fiscalData: {
    documento: string | null;
    nombre: string | null;
    email: string | null;
  };
  title: string;
  description: string | null;
  amount: number | null;
  currency: string | null;
  paymentLinkUrl: string | null;
  hashPedido: string | null;
  invoiceId: string | null;
  failureStage: string | null;
  failureReason: string | null;
  items: unknown[];
  startAt?: string;
  endAt?: string;
  createdAt: string;
  paidAt: string | null;
  invoicedAt: string | null;
}

interface SalesHistoryResponse {
  events: CommercialEvent[];
  summary: {
    orders: number;
    paid: number;
    invoiced: number;
    errors: number;
    meetings: number;
    revenue: number;
  };
}

const EMPTY_HISTORY: SalesHistoryResponse = {
  events: [],
  summary: { orders: 0, paid: 0, invoiced: 0, errors: 0, meetings: 0, revenue: 0 },
};

const STATUS_CONFIG: Record<string, { label: string, variant: any }> = {
  ORDER: { label: 'Pedido', variant: 'primary' },
  PAID: { label: 'Pagado', variant: 'success' },
  INVOICED: { label: 'Facturado', variant: 'success' },
  PAID_INVOICE_ERROR: { label: 'Error Factura', variant: 'warning' },
  ERROR: { label: 'Error', variant: 'danger' },
  MEETING: { label: 'Reunión', variant: 'warning' },
  CANCELLED: { label: 'Cancelado', variant: 'neutral' },
};

const formatCurrency = (amount: number | null) =>
  amount === null ? '—' : `Gs. ${amount.toLocaleString('es-PY')}`;

export const AutonomousSalesPage = () => {
  const [lines, setLines] = useState<{ id: string; name: string }[]>([]);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [salesEnabled, setSalesEnabled] = useState(false);
  const [pagopar, setPagopar] = useState<PagoParFormState>({ baseUrl: '', publicKey: '', privateKey: '', sandboxMode: true });
  const [facturador, setFacturador] = useState<FacturadorFormState>({
    baseUrl: '', accessKey: '', secretKey: '', emisorId: '', bodyTemplate: '{}', successExample: '', isActive: true
  });
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [history, setHistory] = useState<SalesHistoryResponse>(EMPTY_HISTORY);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'HISTORY' | 'PAYMENTS' | 'INVOICING'>('HISTORY');
  const toast = useToast();

  const loadHistory = useCallback(async (lineId: string) => {
    setLoadingHistory(true);
    try {
      const data = await apiFetchJson<SalesHistoryResponse>(`/api/lines/${lineId}/sales?limit=100`);
      setHistory(data);
    } catch { setHistory(EMPTY_HISTORY); } finally { setLoadingHistory(false); }
  }, []);

  useEffect(() => {
    apiFetchJson<any>('/api/lines').then(d => {
      setLines(d.lines || []);
      if (d.lines?.length > 0) setSelectedLineId(d.lines[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedLineId) return;
    loadHistory(selectedLineId);
    apiFetchJson<SalesConfig>(`/api/lines/${selectedLineId}/sales-config`).then(data => {
      setSalesEnabled(data.autonomousSalesEnabled);
      if (data.pagoParConfig) setPagopar({ ...pagopar, publicKey: data.pagoParConfig.publicKey, sandboxMode: data.pagoParConfig.sandboxMode });
      if (data.facturadorConfig) setFacturador({ ...facturador, baseUrl: data.facturadorConfig.baseUrl, accessKey: data.facturadorConfig.accessKey, isActive: data.facturadorConfig.isActive });
    });
  }, [selectedLineId, loadHistory]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetchJson(`/api/lines/${selectedLineId}/sales-config`, {
        method: 'PUT',
        body: JSON.stringify({
          autonomousSalesEnabled: salesEnabled,
          pagoParConfig: { publicKey: pagopar.publicKey, sandboxMode: pagopar.sandboxMode },
          facturadorConfig: { baseUrl: facturador.baseUrl, accessKey: facturador.accessKey, isActive: facturador.isActive }
        }),
      });
      toast.show('Ventas configuradas correctamente.', { variant: 'success' });
    } catch { toast.show('Error al guardar.', { variant: 'error' }); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Ventas & Conversión</h1>
          <p className="text-muted-foreground mt-2 font-medium">Automatiza el flujo comercial desde el primer chat hasta la factura final.</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="flex items-center gap-2 pr-4 border-r border-border/50">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Línea</span>
              <select value={selectedLineId} onChange={e => setSelectedLineId(e.target.value)} className="bg-white border border-border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
           </div>
           <Button variant="primary" size="md" className="rounded-xl font-black text-[10px] tracking-widest shadow-premium" onClick={handleSave} loading={saving}>
              SINCRONIZAR VENTAS
           </Button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         {[
           { label: 'Pedidos', val: history.summary.orders, icon: 'receipt_long', color: 'text-primary' },
           { label: 'Cobrados', val: history.summary.paid, icon: 'payments', color: 'text-success' },
           { label: 'Citas', val: history.summary.meetings, icon: 'event', color: 'text-warning' },
           { label: 'Revenue', val: formatCurrency(history.summary.revenue), icon: 'trending_up', color: 'text-primary', wide: true }
         ].map((s, i) => (
           <Card key={i} variant="solid" className={cn("p-6 flex flex-col justify-between h-32", s.wide && "md:col-span-1")}>
              <div className="flex items-center justify-between">
                 <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{s.label}</span>
                 <Icon name={s.icon} size="sm" className={s.color} />
              </div>
              <p className={cn("text-2xl font-black text-foreground tracking-tight", s.label === 'Revenue' && "text-lg")}>{s.val}</p>
           </Card>
         ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Navigation Sidebar */}
        <div className="space-y-6">
           <Card variant="solid" className="p-2 border-none bg-muted/30">
              <div className="flex flex-col gap-1">
                 {[
                   { id: 'HISTORY', label: 'Historial Comercial', icon: 'history' },
                   { id: 'PAYMENTS', label: 'Pasarela de Pago', icon: 'credit_card' },
                   { id: 'INVOICING', label: 'Facturación SIFEN', icon: 'receipt' }
                 ].map(tab => (
                   <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                      activeTab === tab.id ? "bg-white text-primary shadow-sm border border-border/50" : "text-muted-foreground hover:bg-white/50"
                    )}
                   >
                     <Icon name={tab.icon} size="sm" />
                     {tab.label}
                   </button>
                 ))}
              </div>
           </Card>

           <Card variant="solid" className={cn("border-none transition-colors", salesEnabled ? "bg-success/5 border-success/10" : "bg-muted/20")}>
              <div className="flex items-center justify-between mb-4">
                 <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest">Motor Autónomo</h4>
                 <div 
                  onClick={() => setSalesEnabled(!salesEnabled)}
                  className={cn("w-10 h-5 rounded-full relative cursor-pointer transition-colors", salesEnabled ? "bg-success" : "bg-muted")}
                 >
                    <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", salesEnabled ? "left-6" : "left-1")} />
                 </div>
              </div>
              <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">
                 {salesEnabled ? "IA autorizada para cerrar ventas, generar links de PagoPar y agendar citas automáticamente." : "El bot solo actuará como informante. No podrá procesar transacciones."}
              </p>
           </Card>
        </div>

        {/* Tab Content */}
        <div className="lg:col-span-3">
           {activeTab === 'HISTORY' && (
             <Card variant="solid" className="p-0 border-none shadow-premium overflow-hidden">
                <div className="p-6 border-b border-border/50 bg-muted/10 flex justify-between items-center">
                   <h3 className="text-sm font-black text-foreground uppercase tracking-widest">Eventos de Conversión</h3>
                   <Button variant="ghost" size="sm" onClick={() => loadHistory(selectedLineId)}><Icon name="refresh" size="xs" /></Button>
                </div>
                <div className="overflow-x-auto">
                   <table className="w-full">
                      <thead>
                         <tr className="text-left bg-muted/20">
                            <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Estado</th>
                            <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Cliente</th>
                            <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Concepto</th>
                            <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Monto</th>
                            <th className="px-6 py-4 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Fecha</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-border/30">
                         {loadingHistory ? (
                           Array.from({ length: 3 }).map((_, i) => <tr key={i}><td colSpan={5} className="px-6 py-4 animate-pulse"><div className="h-10 bg-muted rounded-xl w-full" /></td></tr>)
                         ) : history.events.length === 0 ? (
                           <tr><td colSpan={5} className="px-6 py-20 text-center text-xs font-bold text-muted-foreground">Sin actividad registrada para esta línea.</td></tr>
                         ) : history.events.map(ev => {
                           const st = STATUS_CONFIG[ev.status] || { label: ev.status, variant: 'neutral' };
                           return (
                             <tr key={ev.id} className="hover:bg-muted/10 transition-colors">
                                <td className="px-6 py-5"><Badge variant={st.variant} size="sm" className="font-black text-[9px] uppercase">{st.label}</Badge></td>
                                <td className="px-6 py-5">
                                   <p className="text-xs font-bold text-foreground">{ev.clientName || ev.clientPhone}</p>
                                   <p className="text-[10px] text-muted-foreground font-medium">{ev.clientPhone}</p>
                                </td>
                                <td className="px-6 py-5 text-xs font-medium text-foreground truncate max-w-[200px]">{ev.title}</td>
                                <td className="px-6 py-5 text-xs font-black text-foreground">{formatCurrency(ev.amount)}</td>
                                <td className="px-6 py-5 text-[10px] font-bold text-muted-foreground/60">{new Date(ev.createdAt).toLocaleDateString()}</td>
                             </tr>
                           )
                         })}
                      </tbody>
                   </table>
                </div>
             </Card>
           )}

           {activeTab === 'PAYMENTS' && (
             <div className="space-y-8 animate-in">
                <Card variant="solid" className="bg-slate-900 border-none relative overflow-hidden group">
                   <div className="relative z-10 space-y-6">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-white"><Icon name="credit_card" size="md" /></div>
                         <div>
                            <h3 className="text-white font-black text-lg tracking-tight">Pasarela PagoPar</h3>
                            <p className="text-white/40 text-xs font-medium">Conecta tu cuenta para procesar pagos de tarjetas y billeteras.</p>
                         </div>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">Public Key</label>
                            <input value={pagopar.publicKey} onChange={e => setPagopar({...pagopar, publicKey: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono focus:border-white/30 outline-none" placeholder="pk_..." />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">Entorno</label>
                            <div className="flex gap-2">
                               {['TEST', 'PROD'].map(m => (
                                 <button 
                                  key={m}
                                  onClick={() => setPagopar({...pagopar, sandboxMode: m === 'TEST'})}
                                  className={cn("flex-1 py-3 rounded-xl text-[10px] font-black tracking-widest transition-all", (m === 'TEST' ? pagopar.sandboxMode : !pagopar.sandboxMode) ? "bg-white text-slate-900 shadow-xl" : "bg-white/5 text-white/40 hover:bg-white/10")}
                                 >
                                   {m}
                                 </button>
                               ))}
                            </div>
                         </div>
                      </div>
                   </div>
                   <Icon name="account_balance_wallet" size="xl" className="absolute -right-6 -bottom-6 w-48 h-48 text-white/5 rotate-12" />
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <Card variant="solid">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="w-8 h-8 rounded-lg bg-info/10 text-info flex items-center justify-center"><Icon name="help" size="xs" /></div>
                         <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest">¿Cómo funciona?</h4>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                         Cuando un cliente confirma un interés de compra, la IA genera un link de pago único y lo envía por WhatsApp. Al confirmarse el pago, Boti te notifica en el Dashboard.
                      </p>
                   </Card>
                   <Card variant="solid">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center"><Icon name="verified" size="xs" /></div>
                         <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest">Seguridad</h4>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                         Toda la transacción ocurre en los servidores seguros de PagoPar. Boti no almacena datos de tarjetas.
                      </p>
                   </Card>
                </div>
             </div>
           )}

           {activeTab === 'INVOICING' && (
             <div className="space-y-8 animate-in">
                <Card variant="solid" className="relative overflow-hidden border-none bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl">
                   <div className="relative z-10 space-y-6">
                      <div className="flex items-center gap-4">
                         <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center"><Icon name="receipt" size="md" /></div>
                         <div>
                            <h3 className="text-white font-black text-lg tracking-tight">Facturación Electrónica SIFEN</h3>
                            <p className="text-white/60 text-xs font-medium">Integración directa para emitir facturas legales automáticamente.</p>
                         </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">API Endpoint</label>
                            <input value={facturador.baseUrl} onChange={e => setFacturador({...facturador, baseUrl: e.target.value})} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-xs font-mono focus:border-white/40 outline-none" placeholder="https://api..." />
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/50 uppercase tracking-widest">Access Key</label>
                            <input value={facturador.accessKey} onChange={e => setFacturador({...facturador, accessKey: e.target.value})} className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-xs font-mono focus:border-white/40 outline-none" placeholder="ak_..." />
                         </div>
                      </div>
                   </div>
                   <Icon name="description" size="xl" className="absolute -right-8 -top-8 w-48 h-48 text-white/5 -rotate-12" />
                </Card>

                <Card variant="solid">
                   <div className="flex items-center justify-between mb-6">
                      <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest">Flujo de Factura</h4>
                      <div className={cn("px-3 py-1 rounded-full text-[10px] font-black", facturador.isActive ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{facturador.isActive ? 'ACTIVO' : 'PAUSADO'}</div>
                   </div>
                   <div className="flex flex-col md:flex-row gap-8 items-center text-center">
                      {[
                        { label: 'Pago Exitoso', desc: 'PagoPar confirma la transacción' },
                        { label: 'Captura de Datos', desc: 'IA pide RUC y Nombre por WhatsApp' },
                        { label: 'Emisión SIFEN', desc: 'Se genera y envía la factura legal' }
                      ].map((s, i) => (
                        <div key={i} className="flex-1 space-y-2 relative">
                           <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-black mx-auto flex items-center justify-center text-xs shadow-premium">{i+1}</div>
                           <p className="text-xs font-bold text-foreground">{s.label}</p>
                           <p className="text-[10px] text-muted-foreground font-medium">{s.desc}</p>
                        </div>
                      ))}
                   </div>
                </Card>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
