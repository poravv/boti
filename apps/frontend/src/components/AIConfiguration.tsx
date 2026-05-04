import { useEffect, useState } from 'react';
import { apiFetchJson } from '../lib/apiClient';
import {
  Badge,
  Button,
  Card,
  FormInput,
  FormSelect,
  Icon,
  useToast,
  cn,
} from './ui';

interface AIConfig {
  systemPrompt: string;
  businessContext: Record<string, unknown>;
  assignedAiProvider: string;
  hasApiKey?: boolean;
  aiModel?: string;
}

interface ModelOption {
  value: string;
  label: string;
  badge?: string;
}

const MODELS_BY_PROVIDER: Record<string, ModelOption[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Omni)', badge: 'Best' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o3-mini', label: 'o3 Mini (Reasoning)' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', badge: 'Fastest' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet', badge: 'Recommended' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
  ],
};

const AIConfiguration = () => {
  const [lines, setLines] = useState<{ id: string; name: string }[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [config, setConfig] = useState<AIConfig>({
    systemPrompt: '',
    businessContext: {},
    assignedAiProvider: 'openai',
  });
  const [jsonText, setJsonText] = useState('{}');
  const [newApiKey, setNewApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'PROMPT' | 'KNOWLEDGE' | 'CONFIG'>('PROMPT');
  const toast = useToast();

  useEffect(() => {
    const fetchLines = async () => {
      try {
        const data = await apiFetchJson<{ lines: { id: string; name: string }[] }>('/api/lines');
        setLines(data.lines || []);
        if (data.lines?.length > 0 && !selectedLineId) setSelectedLineId(data.lines[0].id);
      } catch (err) { console.error(err); }
    };
    fetchLines();
  }, []);

  useEffect(() => {
    if (!selectedLineId) return;
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const [contextData, configData] = await Promise.all([
          apiFetchJson<any>(`/api/lines/${selectedLineId}/context`),
          apiFetchJson<any>(`/api/lines/${selectedLineId}/config`),
        ]);
        setConfig(prev => ({ ...prev, ...contextData, ...configData }));
        setJsonText(JSON.stringify(contextData.businessContext || {}, null, 2));
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchConfig();
  }, [selectedLineId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let parsedContext = {};
      try { parsedContext = JSON.parse(jsonText); } catch {
        toast.show('JSON inválido en el contexto de negocio.', { variant: 'error' });
        setSaving(false);
        return;
      }
      await apiFetchJson(`/api/lines/${selectedLineId}/context`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessContext: parsedContext, systemPrompt: config.systemPrompt }),
      });
      const configPayload: any = { assignedAiProvider: config.assignedAiProvider, aiModel: config.aiModel };
      if (newApiKey.trim()) configPayload.aiApiKey = newApiKey.trim();
      await apiFetchJson(`/api/lines/${selectedLineId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configPayload),
      });
      toast.show('Configuración actualizada con éxito.', { variant: 'success' });
    } catch { toast.show('Error al guardar.', { variant: 'error' }); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Cerebro de IA</h1>
          <p className="text-muted-foreground mt-2 font-medium">Configura cómo piensa y qué sabe tu asistente para cada línea.</p>
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-border shadow-sm">
           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-2">Línea activa</span>
           <select 
            value={selectedLineId}
            onChange={(e) => setSelectedLineId(e.target.value)}
            className="bg-muted/50 border-none rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all"
           >
             {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
           </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-8">
          {/* Tabs Navigation */}
          <div className="flex gap-2 p-1.5 bg-muted/40 rounded-2xl border border-border/50 w-fit">
            {[
              { id: 'PROMPT', label: 'Personalidad', icon: 'psychology' },
              { id: 'KNOWLEDGE', label: 'Conocimiento', icon: 'database' },
              { id: 'CONFIG', label: 'Parámetros', icon: 'settings' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                  activeTab === tab.id ? "bg-white text-primary shadow-premium border border-primary/10" : "text-muted-foreground hover:bg-white/50"
                )}
              >
                <Icon name={tab.icon} size="xs" />
                {tab.label}
              </button>
            ))}
          </div>

          <Card variant="solid" className="min-h-[500px] flex flex-col">
            {activeTab === 'PROMPT' && (
              <div className="flex-1 flex flex-col space-y-6 animate-in">
                <div className="flex justify-between items-center">
                   <div>
                      <h3 className="text-lg font-bold text-foreground">Prompt del Sistema</h3>
                      <p className="text-xs text-muted-foreground font-medium">Define el rol, tono y restricciones del bot.</p>
                   </div>
                   <Badge variant="primary" size="sm">{config.systemPrompt.length} caracteres</Badge>
                </div>
                <textarea
                  value={config.systemPrompt}
                  onChange={(e) => setConfig({...config, systemPrompt: e.target.value})}
                  placeholder="Eres un asistente experto en..."
                  className="flex-1 w-full bg-muted/20 border border-border/50 rounded-2xl p-6 text-sm font-medium leading-relaxed focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 transition-all outline-none resize-none custom-scrollbar"
                />
              </div>
            )}

            {activeTab === 'KNOWLEDGE' && (
              <div className="flex-1 flex flex-col space-y-6 animate-in">
                <div className="flex justify-between items-center">
                   <div>
                      <h3 className="text-lg font-bold text-foreground">Base de Datos JSON</h3>
                      <p className="text-xs text-muted-foreground font-medium">Información específica de tu negocio que el bot consultará.</p>
                   </div>
                   <Button variant="ghost" size="sm" onClick={() => setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2))}>
                      Formatear JSON
                   </Button>
                </div>
                <div className="flex-1 relative group">
                  <textarea
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    spellCheck={false}
                    className="w-full h-full bg-slate-900 text-slate-300 font-mono text-[11px] p-6 rounded-2xl border border-slate-800 focus:ring-4 focus:ring-primary/5 transition-all outline-none resize-none custom-scrollbar"
                  />
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Badge variant="neutral" className="bg-slate-800 text-slate-400 border-slate-700">Read-Only Mode Off</Badge>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'CONFIG' && (
              <div className="flex-1 space-y-10 animate-in">
                 <div className="space-y-6">
                    <h3 className="text-lg font-bold text-foreground">Proveedor & Modelo</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       <FormSelect 
                        label="Proveedor de IA"
                        value={config.assignedAiProvider}
                        onChange={(e) => setConfig({...config, assignedAiProvider: e.target.value})}
                       >
                         <option value="openai">OpenAI (ChatGPT)</option>
                         <option value="gemini">Google Cloud (Gemini)</option>
                         <option value="anthropic">Anthropic (Claude)</option>
                       </FormSelect>
                       <FormSelect 
                        label="Modelo Específico"
                        value={config.aiModel}
                        onChange={(e) => setConfig({...config, aiModel: e.target.value})}
                       >
                         {MODELS_BY_PROVIDER[config.assignedAiProvider]?.map(m => (
                           <option key={m.value} value={m.value}>{m.label}</option>
                         ))}
                       </FormSelect>
                    </div>
                 </div>

                 <div className="space-y-6">
                    <h3 className="text-lg font-bold text-foreground">Seguridad</h3>
                    <div className="max-w-md">
                       <FormInput 
                        label="API Key Personalizada"
                        type="password"
                        placeholder={config.hasApiKey ? '••••••••••••••••' : 'Ingresa tu clave si prefieres usar tu propia cuenta'}
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                       />
                    </div>
                 </div>
              </div>
            )}
          </Card>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
           <Card variant="solid" className="bg-primary text-primary-foreground border-none shadow-glass-xl relative overflow-hidden group">
              <div className="relative z-10 space-y-6">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                       <Icon name="verified_user" size="md" />
                    </div>
                    <h4 className="font-black uppercase tracking-widest text-xs">Publicar Cambios</h4>
                 </div>
                 <p className="text-xs font-medium text-primary-foreground/70">
                    Al guardar, la IA actualizará su conocimiento instantáneamente para todos los clientes activos.
                 </p>
                 <Button 
                  variant="primary" 
                  size="lg" 
                  fullWidth 
                  className="bg-white text-primary hover:bg-gray-50 border-none shadow-premium font-black tracking-widest text-[10px]"
                  loading={saving}
                  onClick={handleSave}
                 >
                    SINCRONIZAR CEREBRO
                 </Button>
              </div>
              <Icon name="sparkles" size="xl" className="absolute -right-4 -bottom-4 text-white/5 w-32 h-32 rotate-12 transition-transform group-hover:scale-125" />
           </Card>

           <Card variant="solid">
              <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Mejores Prácticas</h4>
              <ul className="space-y-4">
                 {[
                   { title: 'Tono Consistente', desc: 'Define si el bot trata de "tú" o "usted".' },
                   { title: 'Evita Alucinaciones', desc: 'Indica claramente qué responder si no sabe algo.' },
                   { title: 'JSON Estructurado', desc: 'Usa listas simples para precios y servicios.' }
                 ].map((item, i) => (
                   <li key={i} className="flex gap-3">
                      <div className="w-6 h-6 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
                         <Icon name="check" size="xs" />
                      </div>
                      <div>
                         <p className="text-xs font-bold text-foreground">{item.title}</p>
                         <p className="text-[10px] text-muted-foreground font-medium">{item.desc}</p>
                      </div>
                   </li>
                 ))}
              </ul>
           </Card>
        </div>
      </div>
    </div>
  );
};

export default AIConfiguration;
