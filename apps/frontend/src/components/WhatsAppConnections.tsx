import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface WhatsAppLine {
  id: string;
  name: string;
  phone: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'QR_PENDING';
  qrCode?: string;
}

const WhatsAppConnections = () => {
  const [lines, setLines] = useState<WhatsAppLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLineName, setNewLineName] = useState('');
  const [activeQrLine, setActiveQrLine] = useState<string | null>(null);
  const [currentQr, setCurrentQr] = useState<string | null>(null);

  const token = localStorage.getItem('token');

  const fetchLines = async () => {
    try {
      const res = await fetch('/api/lines', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setLines(data.lines || []);
    } catch (err) {
      console.error('Error fetching lines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLines();
    
    // WebSocket setup
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const { event: wsEvent, data } = JSON.parse(event.data);
        if (wsEvent === 'line:status') {
          setLines(prev => prev.map(line => 
            line.id === data.lineId 
              ? { ...line, status: data.status, qrCode: data.qrCode } 
              : line
          ));
        }
      } catch (err) {
        console.error('WS parsing error:', err);
      }
    };

    ws.onopen = () => console.log('WS Connected to Boti Backend');
    ws.onclose = () => console.log('WS Disconnected');

    return () => ws.close();
  }, [token]);

  // Auto-update currentQr if activeQrLine is set
  useEffect(() => {
    if (activeQrLine) {
      const activeLine = lines.find(l => l.id === activeQrLine);
      if (activeLine?.qrCode) {
        setCurrentQr(activeLine.qrCode);
      }
      
      // If the line is already connected, clear the active QR view
      if (activeLine?.status === 'CONNECTED') {
        setActiveQrLine(null);
        setCurrentQr(null);
      }
    }
  }, [lines, activeQrLine]);

  const handleAddLine = async (existingId?: string) => {
    if (!existingId && !newLineName) return;
    const lineId = existingId || newLineName.toLowerCase().replace(/\s+/g, '-');
    
    try {
      // Connect first to get QR
      const res = await fetch(`/api/lines/${lineId}/connect`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setActiveQrLine(lineId);
      setCurrentQr(data.qrCode);
      setShowAddLine(false);
      setNewLineName(''); // Clear input
      fetchLines();
    } catch (err) {
      console.error('Error adding/reconnecting line:', err);
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await fetch(`/api/lines/${id}/disconnect`, { 
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchLines();
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black text-primary tracking-tighter">Connection Management</h1>
          <p className="text-on-surface-variant font-medium mt-2">Manage your WhatsApp bot instances and link new numbers via QR code.</p>
        </div>
        <button 
          onClick={() => setShowAddLine(true)}
          className="px-6 py-3 bg-secondary text-on-primary rounded-xl flex items-center gap-2 font-bold shadow-lg hover:shadow-secondary/20 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined">add</span>
          NEW CONNECTION
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* QR Section (Bento Main) */}
        <div className="lg:col-span-8 glass-card rounded-2xl p-8 flex flex-col md:flex-row gap-8 shadow-sm">
          <div className="flex-1 space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-primary">Vincular Dispositivo</h2>
              <p className="text-on-surface-variant text-sm mt-2">
                {activeQrLine 
                  ? `Vinculando: ${activeQrLine}`
                  : 'Escanea el código QR para autorizar a Boti como un dispositivo vinculado.'
                }
              </p>
            </div>
            
            <div className="space-y-3">
              {[
                'Abre WhatsApp en tu teléfono',
                'Ve a Ajustes > Dispositivos Vinculados',
                'Escanea el código QR que aparece a la derecha'
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-secondary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-secondary font-bold text-xs">{i + 1}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant font-medium">{step}</p>
                </div>
              ))}
            </div>

            {activeQrLine && (
              <div className="pt-4 flex gap-3">
                <button 
                  onClick={() => setActiveQrLine(null)}
                  className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container transition-colors"
                >
                  CANCELAR
                </button>
              </div>
            )}
          </div>

          <div className="w-full md:w-64 aspect-square glass-card rounded-2xl border-2 border-dashed border-teal-500/30 flex items-center justify-center relative overflow-hidden bg-white p-4">
            {activeQrLine && currentQr ? (
              <div className="p-4 bg-white rounded-xl shadow-inner">
                <QRCodeSVG value={currentQr} size={200} />
              </div>
            ) : (
              <div className="text-center opacity-40">
                <span className="material-symbols-outlined text-6xl text-teal-600 mb-2">qr_code_2</span>
                <p className="text-[10px] font-black uppercase tracking-widest">Esperando...</p>
              </div>
            )}
            {activeQrLine && !currentQr && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
                <div className="w-8 h-8 border-4 border-secondary border-t-transparent rounded-full animate-spin mb-2"></div>
                <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Generando QR</p>
              </div>
            )}
          </div>
        </div>

        {/* Info Cards (Bento Side) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card rounded-2xl p-6 flex-1 shadow-sm flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full -mr-8 -mt-8"></div>
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">System Pulse</span>
            <div className="flex items-center justify-between my-4">
              <span className="text-4xl font-black text-primary">{lines.filter(l => l.status === 'CONNECTED').length}</span>
              <span className="material-symbols-outlined text-teal-500 text-4xl">hub</span>
            </div>
            <p className="text-xs text-on-surface-variant font-medium leading-relaxed">
              Líneas activas procesando interacciones en tiempo real.
            </p>
          </div>
          <div className="glass-card rounded-2xl p-6 flex-1 shadow-sm flex flex-col justify-between overflow-hidden relative">
            <div className="absolute -bottom-2 -right-2 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl"></div>
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">Uptime Average</span>
            <div className="text-2xl font-black text-primary my-4">99.8%</div>
            <div className="h-2 bg-surface-container rounded-full overflow-hidden">
               <div className="h-full bg-secondary w-[99.8%] rounded-full shadow-[0_0_8px_rgba(0,107,95,0.4)]"></div>
            </div>
          </div>
        </div>

        {/* Lines List */}
        <div className="lg:col-span-12 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-primary">Connected Numbers</h3>
            <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest opacity-60">
              {lines.length} / 5 LIMIT
            </span>
          </div>

          {loading && lines.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center glass-card rounded-2xl border-dashed">
              <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
              <p className="text-on-surface-variant font-bold uppercase tracking-widest text-[10px]">Cargando líneas...</p>
            </div>
          ) : lines.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center glass-card rounded-2xl border-dashed text-center px-6">
              <span className="material-symbols-outlined text-6xl text-outline-variant mb-4">smartphone</span>
              <h4 className="text-lg font-bold text-on-surface-variant">Sin líneas conectadas</h4>
              <p className="text-sm text-on-surface-variant/60 max-w-sm mt-2">
                No tienes ninguna línea de WhatsApp vinculada. Haz clic en el botón superior para agregar la primera.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lines.map((line) => (
                <div key={line.id} className="glass-card rounded-2xl p-5 flex items-center justify-between gap-4 hover:shadow-xl hover:translate-y-[-2px] transition-all duration-300 group relative overflow-hidden">
                  {/* Subtle status background glow */}
                  <div className={`absolute inset-0 opacity-[0.03] pointer-events-none ${
                    line.status === 'CONNECTED' ? 'bg-emerald-500' : 
                    line.status === 'QR_PENDING' ? 'bg-amber-500' : 'bg-red-500'
                  }`}></div>

                  <div className="flex items-center gap-4 relative">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                      line.status === 'CONNECTED' ? 'bg-emerald-100/50 text-emerald-600' : 
                      line.status === 'QR_PENDING' ? 'bg-amber-100/50 text-amber-600' : 'bg-slate-100/50 text-slate-400'
                    }`}>
                      <span className="material-symbols-outlined text-2xl">smartphone</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-on-surface flex items-center gap-2">
                        {line.name}
                        <div className={`w-2 h-2 rounded-full ${
                          line.status === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 
                          line.status === 'QR_PENDING' ? 'bg-amber-500' : 'bg-red-500'
                        }`}></div>
                      </h4>
                      <p className="text-[11px] text-on-surface-variant font-mono opacity-70">
                        {line.status === 'CONNECTED' ? (line.phone || 'ACTIVE SESSION') : 'READY TO LINK'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:block text-right">
                       <span className={`text-[9px] font-black px-2 py-1 rounded-md tracking-widest ${
                         line.status === 'CONNECTED' ? 'bg-emerald-100 text-emerald-700' : 
                         line.status === 'QR_PENDING' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                       }`}>
                         {line.status}
                       </span>
                    </div>
                    
                    {line.status !== 'CONNECTED' && (
                      <button 
                        onClick={() => {
                          setActiveQrLine(line.id);
                          handleAddLine(line.id); // Re-use connection logic
                        }}
                        className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-black hover:bg-primary hover:text-white transition-all flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-sm">qr_code</span>
                        RECONNECT
                      </button>
                    )}

                    <button 
                      onClick={() => handleDisconnect(line.id)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant text-on-surface-variant hover:text-error hover:bg-error/5 transition-all"
                      title="Logout/Remove"
                    >
                      <span className="material-symbols-outlined text-lg">link_off</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Line Modal */}
      {showAddLine && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-on-background/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-outline-variant animate-in zoom-in-95 duration-300">
            <h3 className="text-2xl font-black text-primary mb-2">New WhatsApp Line</h3>
            <p className="text-on-surface-variant text-sm mb-6 font-medium">Asigna un nombre interno para identificar esta línea.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest block mb-2 px-1">Friendly Name</label>
                <input 
                  type="text" 
                  placeholder="Ej. Ventas Argentina" 
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant focus:border-primary focus:ring-2 ring-primary/20 outline-none transition-all"
                  value={newLineName}
                  onChange={(e) => setNewLineName(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setShowAddLine(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  CANCEL
                </button>
                <button 
                  onClick={() => handleAddLine()}
                  className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-black shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95"
                >
                  CREATE & LINK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WhatsAppConnections;
