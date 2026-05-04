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

const PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    subtitle: 'GPT-4o · o3-mini',
    icon: 'model_training',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    activeBg: 'bg-emerald-500/10 border-emerald-500',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    subtitle: 'Flash · Pro',
    icon: 'auto_awesome',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    activeBg: 'bg-blue-500/10 border-blue-500',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    subtitle: 'Claude 3.5',
    icon: 'smart_toy',
    color: 'text-orange-600',
    bg: 'bg-orange-50 border-orange-200',
    activeBg: 'bg-orange-500/10 border-orange-500',
  },
] as const;

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o',      label: 'GPT-4o (Omni) — Recomendado' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini — Más económico'  },
    { value: 'o3-mini',     label: 'o3 Mini — Razonamiento'        },
  ],
  gemini: [
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash — Más rápido' },
    { value: 'gemini-1.5-pro',   label: 'Gemini 1.5 Pro — Más preciso'  },
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet — Recomendado' },
    { value: 'claude-3-5-haiku-latest',  label: 'Claude 3.5 Haiku — Más rápido'   },
  ],
};

type Tab = 'PROMPT' | 'KNOWLEDGE' | 'CONFIG';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'PROMPT',    label: 'Personalidad',  icon: 'psychology'  },
  { id: 'KNOWLEDGE', label: 'Conocimiento',  icon: 'database'    },
  { id: 'CONFIG',    label: 'Parámetros',    icon: 'tune'        },
];

const AIConfiguration = () => {
  const [lines,          setLines]          = useState<{ id: string; name: string }[]>([]);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [config,         setConfig]         = useState<AIConfig>({
    systemPrompt: '',
    businessContext: {},
    assignedAiProvider: 'openai',
    aiModel: 'gpt-4o',
  });
  const [jsonText,    setJsonText]    = useState('{}');
  const [jsonError,   setJsonError]   = useState('');
  const [newApiKey,   setNewApiKey]   = useState('');
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [activeTab,   setActiveTab]   = useState<Tab>('PROMPT');
  const [showApiKey,  setShowApiKey]  = useState(false);
  const toast = useToast();

  useEffect(() => {
    apiFetchJson<{ lines: { id: string; name: string }[] }>('/api/lines')
      .then(data => {
        setLines(data.lines || []);
        if (data.lines?.length > 0) setSelectedLineId(data.lines[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedLineId) return;
    setLoading(true);
    Promise.all([
      apiFetchJson<any>(`/api/lines/${selectedLineId}/context`),
      apiFetchJson<any>(`/api/lines/${selectedLineId}/config`),
    ])
      .then(([ctx, cfg]) => {
        setConfig(prev => ({ ...prev, ...ctx, ...cfg }));
        setJsonText(JSON.stringify(ctx.businessContext || {}, null, 2));
        setJsonError('');
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedLineId]);

  const validateJson = (text: string) => {
    try { JSON.parse(text); setJsonError(''); return true; }
    catch (e: any) { setJsonError(e.message); return false; }
  };

  const handleSave = async () => {
    if (!validateJson(jsonText)) {
      toast.show('Corrige el JSON antes de guardar.', { variant: 'error' });
      return;
    }
    setSaving(true);
    try {
      await apiFetchJson(`/api/lines/${selectedLineId}/context`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessContext: JSON.parse(jsonText),
          systemPrompt: config.systemPrompt,
        }),
      });
      const cfgPayload: any = {
        assignedAiProvider: config.assignedAiProvider,
        aiModel: config.aiModel,
      };
      if (newApiKey.trim()) cfgPayload.aiApiKey = newApiKey.trim();
      await apiFetchJson(`/api/lines/${selectedLineId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfgPayload),
      });
      setNewApiKey('');
      toast.show('IA actualizada con éxito.', { variant: 'success' });
    } catch {
      toast.show('Error al guardar. Intenta de nuevo.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const selectedProvider = PROVIDERS.find(p => p.id === config.assignedAiProvider) ?? PROVIDERS[0];

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-action/10 flex items-center justify-center">
              <Icon name="smart_toy" size="md" className="text-action" />
            </div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">Cerebro de IA</h1>
          </div>
          <p className="text-muted-foreground font-medium ml-[52px]">
            Configura el comportamiento y conocimiento de tu asistente.
          </p>
        </div>

        {lines.length > 0 && (
          <div className="flex items-center gap-2 bg-white border border-border rounded-2xl px-4 py-2.5 shadow-sm">
            <Icon name="smartphone" size="sm" className="text-muted-foreground" />
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Línea</span>
            <select
              value={selectedLineId}
              onChange={e => setSelectedLineId(e.target.value)}
              className="bg-transparent border-none text-sm font-bold text-foreground outline-none cursor-pointer"
            >
              {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">

        {/* ── Left column: Tabs + Content ── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Tabs */}
          <div className="flex gap-1 bg-muted/50 p-1 rounded-2xl border border-border/60">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200',
                  activeTab === tab.id
                    ? 'bg-white text-action shadow-sm border border-action/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/60'
                )}
              >
                <Icon name={tab.icon} size="xs" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Content card */}
          <Card variant="solid" padding="none" className="overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className={cn('bg-muted animate-pulse rounded-xl', i === 1 ? 'h-6 w-48' : i === 2 ? 'h-48' : 'h-6 w-32')} />
                ))}
              </div>
            ) : (
              <>
                {/* ─── Personalidad ─── */}
                {activeTab === 'PROMPT' && (
                  <div className="flex flex-col">
                    <div className="px-6 pt-6 pb-4 border-b border-border/50 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-foreground">Prompt del Sistema</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Define el rol, tono y restricciones de la IA.</p>
                      </div>
                      <Badge variant={config.systemPrompt.length > 100 ? 'primary' : 'neutral'} size="sm">
                        {config.systemPrompt.length} / ∞ chars
                      </Badge>
                    </div>
                    <div className="p-1 bg-[#0B1120]">
                      <textarea
                        value={config.systemPrompt}
                        onChange={e => setConfig({ ...config, systemPrompt: e.target.value })}
                        placeholder={'Eres un asistente experto en ventas para [Empresa].\nTu objetivo es...\n\nTono: amigable y profesional\nIdioma: español'}
                        rows={16}
                        className="w-full bg-transparent text-slate-300 font-mono text-[13px] leading-relaxed px-6 py-5 outline-none resize-none custom-scrollbar placeholder:text-slate-600"
                      />
                    </div>
                    <div className="px-6 py-3 border-t border-border/30 flex items-center gap-4 text-[10px] text-muted-foreground font-medium bg-muted/20">
                      <span><kbd className="bg-muted px-1.5 py-0.5 rounded text-[9px] font-bold">Tab</kbd> para indentar</span>
                      <span>·</span>
                      <span>Los cambios se aplican al guardar</span>
                    </div>
                  </div>
                )}

                {/* ─── Conocimiento ─── */}
                {activeTab === 'KNOWLEDGE' && (
                  <div className="flex flex-col">
                    <div className="px-6 pt-6 pb-4 border-b border-border/50 flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-foreground">Base de Conocimiento JSON</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Información de negocio que la IA consultará: precios, servicios, horarios, etc.
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          try {
                            setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
                            setJsonError('');
                          } catch {}
                        }}
                      >
                        <Icon name="format_align_left" size="xs" className="mr-1.5" />
                        Formatear
                      </Button>
                    </div>
                    <div className="bg-[#0B1120] relative">
                      <textarea
                        value={jsonText}
                        onChange={e => { setJsonText(e.target.value); validateJson(e.target.value); }}
                        spellCheck={false}
                        rows={18}
                        className="w-full bg-transparent text-slate-300 font-mono text-[13px] leading-relaxed px-6 py-5 outline-none resize-none custom-scrollbar"
                      />
                    </div>
                    {jsonError ? (
                      <div className="px-6 py-3 bg-error-container/50 border-t border-error/20 flex items-center gap-2">
                        <Icon name="error" size="xs" className="text-error flex-shrink-0" />
                        <p className="text-xs font-medium text-error font-mono">{jsonError}</p>
                      </div>
                    ) : (
                      <div className="px-6 py-3 border-t border-border/30 flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/20">
                        <Icon name="check_circle" size="xs" className="text-success" />
                        <span>JSON válido</span>
                      </div>
                    )}
                  </div>
                )}

                {/* ─── Parámetros ─── */}
                {activeTab === 'CONFIG' && (
                  <div className="p-6 space-y-8">
                    {/* Provider selection */}
                    <div className="space-y-3">
                      <div>
                        <h3 className="text-base font-bold text-foreground">Proveedor de IA</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Elige el motor de inteligencia artificial para esta línea.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {PROVIDERS.map(p => {
                          const isActive = config.assignedAiProvider === p.id;
                          return (
                            <button
                              key={p.id}
                              onClick={() => setConfig({
                                ...config,
                                assignedAiProvider: p.id,
                                aiModel: MODELS_BY_PROVIDER[p.id][0]?.value,
                              })}
                              className={cn(
                                'relative flex flex-col items-start gap-2 p-4 rounded-xl border-2 text-left transition-all duration-200',
                                isActive
                                  ? `${p.activeBg} shadow-sm`
                                  : 'border-border bg-white hover:border-muted-foreground/30 hover:shadow-sm'
                              )}
                            >
                              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', isActive ? p.activeBg : p.bg)}>
                                <Icon name={p.icon} size="sm" className={p.color} />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-foreground">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{p.subtitle}</p>
                              </div>
                              {isActive && (
                                <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-action flex items-center justify-center">
                                  <Icon name="check" size="xs" className="text-white" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Model selection */}
                    <div className="space-y-3 max-w-md">
                      <h3 className="text-base font-bold text-foreground">Modelo Específico</h3>
                      <FormSelect
                        label="Versión del modelo"
                        value={config.aiModel}
                        onChange={e => setConfig({ ...config, aiModel: e.target.value })}
                      >
                        {MODELS_BY_PROVIDER[config.assignedAiProvider]?.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </FormSelect>
                    </div>

                    {/* API Key */}
                    <div className="space-y-3 max-w-md pt-2 border-t border-border/50">
                      <div>
                        <h3 className="text-base font-bold text-foreground">API Key Personalizada</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {config.hasApiKey
                            ? 'Ya tienes una clave configurada. Ingresar una nueva la reemplazará.'
                            : 'Opcional — usa tu propia cuenta del proveedor de IA.'}
                        </p>
                      </div>
                      <div className="relative">
                        <FormInput
                          type={showApiKey ? 'text' : 'password'}
                          placeholder={config.hasApiKey ? '••••••••••••••••' : 'sk-... o AIza...'}
                          value={newApiKey}
                          onChange={e => setNewApiKey(e.target.value)}
                          leadingIcon="key"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKey(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Icon name={showApiKey ? 'lock_open' : 'lock'} size="sm" />
                        </button>
                      </div>
                      {config.hasApiKey && (
                        <p className="flex items-center gap-1.5 text-xs text-success font-medium">
                          <Icon name="check_circle" size="xs" />
                          Clave activa configurada
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </Card>
        </div>

        {/* ── Right column: Actions + Info ── */}
        <div className="space-y-5">

          {/* Save card */}
          <Card variant="solid" padding="none" className="overflow-hidden border-action/20">
            <div className="bg-[#0B1120] px-6 pt-6 pb-5 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-action/20 rounded-xl flex items-center justify-center">
                  <Icon name="auto_awesome" size="md" className="text-action" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Publicar Cambios</h4>
                  <p className="text-[10px] text-white/50 mt-0.5">Se aplica instantáneamente</p>
                </div>
              </div>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={saving}
                onClick={handleSave}
                className="font-black tracking-wider text-[11px] shadow-action-glow"
              >
                <Icon name="save" size="sm" className="mr-2" />
                SINCRONIZAR IA
              </Button>
            </div>

            {/* Current config summary */}
            <div className="px-6 py-4 space-y-3">
              <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Configuración Actual</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Proveedor</span>
                  <Badge variant="primary" size="sm">{selectedProvider.name}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Modelo</span>
                  <span className="text-xs font-semibold text-foreground truncate max-w-[120px]">{config.aiModel || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">API Key</span>
                  <Badge variant={config.hasApiKey ? 'success' : 'neutral'} size="sm">
                    {config.hasApiKey ? 'Activa' : 'Por defecto'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Prompt</span>
                  <span className="text-xs font-semibold text-foreground">{config.systemPrompt.length} chars</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Tips */}
          <Card variant="solid">
            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Mejores Prácticas</h4>
            <ul className="space-y-4">
              {[
                { title: 'Tono consistente',    desc: 'Define si el bot trata de "tú" o "usted".',         icon: 'edit_note'      },
                { title: 'Evita alucinaciones', desc: 'Indica qué responder cuando no sepa algo.',           icon: 'fact_check'     },
                { title: 'JSON estructurado',   desc: 'Usa listas simples para precios y servicios.',        icon: 'data_object'    },
                { title: 'Prueba y ajusta',     desc: 'Envía mensajes de prueba tras cada cambio.',          icon: 'science'        },
              ].map((item, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <div className="w-7 h-7 rounded-lg bg-action/10 text-action flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name={item.icon} size="xs" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{item.desc}</p>
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
