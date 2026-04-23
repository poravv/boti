import React, { useState, useEffect } from 'react';

interface AIConfig {
  systemPrompt: string;
  businessContext: any;
  assignedAiProvider: string;
  aiApiKey?: string;
  aiModel?: string;
}

const AIConfiguration = () => {
  const [lines, setLines] = useState<{ id: string, name: string }[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [config, setConfig] = useState<AIConfig>({
    systemPrompt: '',
    businessContext: {},
    assignedAiProvider: 'gemini'
  });
  const [jsonText, setJsonText] = useState('{}');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchLines = async () => {
      try {
        const res = await fetch('/api/lines', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setLines(data.lines || []);
        if (data.lines?.length > 0 && !selectedLineId) {
          setSelectedLineId(data.lines[0].id);
        }
      } catch (err) {
        console.error('Error fetching lines:', err);
      }
    };
    fetchLines();
  }, [token]);

  useEffect(() => {
    if (!selectedLineId) return;

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/lines/${selectedLineId}/config`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        setConfig(data);
        setJsonText(JSON.stringify(data.businessContext || {}, null, 2));
      } catch (err) {
        console.error('Error fetching config:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [selectedLineId, token]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      let parsedContext = {};
      try {
        parsedContext = JSON.parse(jsonText);
      } catch (e) {
        setMessage({ type: 'error', text: 'Error en el formato JSON del contexto de negocio.' });
        setSaving(false);
        return;
      }

      const res = await fetch(`/api/lines/${selectedLineId}/config`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...config,
          businessContext: parsedContext
        })
      });

      if (res.ok) {
        setMessage({ type: 'success', text: 'Configuración guardada correctamente.' });
      } else {
        throw new Error('Error al guardar');
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Hubo un problema al guardar la configuración.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black text-primary tracking-tighter">AI Configuration</h1>
        <p className="text-on-surface-variant font-medium">Define el comportamiento y contexto de tus agentes inteligentes.</p>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        {/* Main Form */}
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Line Selector */}
          <section className="glass-card p-6 rounded-2xl border border-outline-variant/30 shadow-sm bg-white/70 backdrop-blur-xl">
            <div className="flex items-center gap-3 mb-6 text-secondary">
              <span className="material-symbols-outlined font-variation-settings-fill">account_tree</span>
              <h3 className="font-bold uppercase tracking-wider text-xs">Seleccionar Línea</h3>
            </div>
            <select 
              value={selectedLineId}
              onChange={(e) => setSelectedLineId(e.target.value)}
              className="w-full bg-white border border-outline-variant rounded-xl p-4 text-sm focus:ring-2 focus:ring-secondary focus:border-secondary outline-none transition-all font-bold text-primary"
            >
              {lines.map(line => (
                <option key={line.id} value={line.id}>{line.name}</option>
              ))}
              {lines.length === 0 && <option value="">No hay líneas disponibles</option>}
            </select>
          </section>

          {/* Model & System Prompt */}
          <section className="glass-card p-8 rounded-2xl border border-outline-variant/30 shadow-sm space-y-8 bg-white/70 backdrop-blur-xl">
            <div className="flex items-center gap-3 text-secondary">
              <span className="material-symbols-outlined">psychology_alt</span>
              <h3 className="font-bold uppercase tracking-wider text-sm">Personalidad y Modelo</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">AI Provider</label>
                <select 
                  value={config.assignedAiProvider}
                  onChange={(e) => setConfig({ ...config, assignedAiProvider: e.target.value })}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 ring-secondary/20 transition-all"
                >
                  <option value="gemini">Google Gemini 1.5 Pro</option>
                  <option value="openai">OpenAI GPT-4o</option>
                  <option value="anthropic">Anthropic Claude 3.5</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">Model Name (Optional)</label>
                <input 
                  type="text"
                  value={config.aiModel || ''}
                  onChange={(e) => setConfig({ ...config, aiModel: e.target.value })}
                  placeholder="Ej: gpt-4o, gemini-1.5-pro"
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 ring-secondary/20 transition-all"
                />
                <p className="text-[9px] text-on-surface-variant/60 px-1 italic">Si se deja vacío, se usará el modelo estándar (Flash/Mini).</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest px-1">API Key (Optional)</label>
                <input 
                  type="password"
                  value={config.aiApiKey || ''}
                  onChange={(e) => setConfig({ ...config, aiApiKey: e.target.value })}
                  placeholder="Sk-..."
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-3 text-sm font-semibold outline-none focus:ring-2 ring-secondary/20 transition-all"
                />
                <p className="text-[9px] text-on-surface-variant/60 px-1 italic">Si se deja vacío, se usará la clave configurada por defecto en el servidor.</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">System Prompt</label>
                <span className="text-[10px] font-mono text-on-surface-variant/50">{config.systemPrompt.length} / 4000</span>
              </div>
              <textarea 
                value={config.systemPrompt}
                onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
                className="w-full h-48 bg-surface-container-low border border-outline-variant rounded-2xl p-5 text-sm leading-relaxed focus:ring-2 focus:ring-secondary/20 outline-none transition-all resize-none font-medium text-on-surface"
                placeholder="Ej. Eres un asistente de ventas experto en seguros..."
              />
            </div>
          </section>

          {/* Business Context JSON */}
          <section className="glass-card p-8 rounded-2xl border border-outline-variant/30 shadow-sm space-y-6 bg-white/70 backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-secondary">
                <span className="material-symbols-outlined">database</span>
                <h3 className="font-bold uppercase tracking-wider text-sm">Contexto de Negocio (JSON)</h3>
              </div>
              <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">DATOS DINÁMICOS</span>
            </div>
            
            <p className="text-xs text-on-surface-variant font-medium">
              Define la información base que el bot utilizará para responder (Precios, FAQs, Horarios, etc.) en formato JSON.
            </p>

            <div className="relative group">
              <div className="absolute top-4 right-4 z-10 flex gap-2">
                <button 
                   onClick={() => {
                     try { setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2)); } catch(e) {}
                   }}
                   className="p-2 bg-white/80 backdrop-blur border border-outline-variant rounded-lg hover:bg-white transition-colors"
                   title="Autoformat JSON"
                >
                  <span className="material-symbols-outlined text-sm">format_align_left</span>
                </button>
              </div>
              <textarea 
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="w-full h-80 bg-slate-900 text-teal-400 font-mono text-xs p-6 rounded-2xl border-none focus:ring-2 focus:ring-teal-500/50 outline-none transition-all resize-y shadow-2xl"
                placeholder='{ "empresa": "Mi Negocio", "servicios": [...] }'
              />
            </div>
          </section>
        </div>

        {/* Sidebar Actions */}
        <div className="col-span-12 lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          <div className="bg-primary p-8 rounded-3xl shadow-2xl shadow-primary/30 text-on-primary space-y-6 relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary">verified_user</span>
              <h4 className="font-black uppercase tracking-widest text-[11px]">Guardar Cambios</h4>
            </div>

            <p className="text-sm opacity-80 font-medium">
              Los cambios se aplicarán instantáneamente a todas las conversaciones activas en esta línea.
            </p>

            {message && (
              <div className={`p-4 rounded-xl text-xs font-bold ${
                message.type === 'success' ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'
              } animate-in zoom-in-95 duration-300`}>
                {message.text}
              </div>
            )}

            <button 
              onClick={handleSave}
              disabled={saving || !selectedLineId}
              className="w-full py-4 bg-secondary text-on-primary rounded-2xl font-black shadow-lg shadow-black/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {saving ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <span className="material-symbols-outlined text-lg font-variation-settings-fill">save</span>
              )}
              {saving ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN'}
            </button>
          </div>

          <div className="glass-card p-6 rounded-2xl border border-outline-variant/30 shadow-sm space-y-4 bg-white/70 backdrop-blur-xl">
             <div className="flex items-center gap-2 text-on-surface-variant">
               <span className="material-symbols-outlined text-lg">info</span>
               <span className="text-[10px] font-black uppercase tracking-widest">Tips de Ingeniería</span>
             </div>
             <ul className="space-y-3">
               {[
                 'Usa un system prompt claro y conciso.',
                 'Evita JSONs de más de 50KB para mejor performance.',
                 'Gemini 1.5 Pro maneja mejor contextos largos.'
               ].map((tip, i) => (
                 <li key={i} className="flex gap-2 text-xs font-medium text-on-surface-variant opacity-80">
                   <span className="text-secondary">•</span>
                   {tip}
                 </li>
               ))}
             </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConfiguration;
