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
    { value: 'gpt-4.1', label: 'GPT-4.1', badge: 'Recomendado' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini — Rápido y económico' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'o1-mini', label: 'o1 Mini — Razonamiento avanzado' },
    { value: 'o3-mini', label: 'o3 Mini — Razonamiento avanzado' },
  ],
  gemini: [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', badge: 'Recomendado' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash — Rápido' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro — Contexto largo' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
  ],
  anthropic: [
    { value: 'claude-opus-4-7', label: 'Claude Opus 4.7', badge: 'Más capaz' },
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', badge: 'Recomendado' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 — Rápido y económico' },
  ],
};

const RECOMMENDED_MODEL: Record<string, string> = {
  openai: 'gpt-4.1',
  gemini: 'gemini-2.5-pro',
  anthropic: 'claude-sonnet-4-6',
};

const AIConfiguration = () => {
  const [lines, setLines] = useState<{ id: string; name: string }[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string>('');
  const [config, setConfig] = useState<AIConfig>({
    systemPrompt: '',
    businessContext: {},
    assignedAiProvider: 'gemini',
  });
  const [jsonText, setJsonText] = useState('{}');
  const [newApiKey, setNewApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const fetchLines = async () => {
      try {
        const data = await apiFetchJson<{ lines: { id: string; name: string }[] }>('/api/lines');
        setLines(data.lines || []);
        if (data.lines?.length > 0 && !selectedLineId) {
          setSelectedLineId(data.lines[0].id);
        }
      } catch (err) {
        console.error('Error fetching lines:', err);
      }
    };
    fetchLines();
  }, []);

  useEffect(() => {
    if (!selectedLineId) return;

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const [contextData, configData] = await Promise.all([
          apiFetchJson<{ businessContext: any; systemPrompt: string }>(`/api/lines/${selectedLineId}/context`),
          apiFetchJson<{ assignedAiProvider: string; hasApiKey?: boolean; aiModel?: string }>(`/api/lines/${selectedLineId}/config`),
        ]);
        setConfig(prev => ({ ...prev, ...contextData, ...configData }));
        setNewApiKey('');
        setJsonText(JSON.stringify(contextData.businessContext || {}, null, 2));
      } catch (err) {
        console.error('Error fetching config:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, [selectedLineId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let parsedContext: Record<string, unknown> = {};
      try {
        parsedContext = JSON.parse(jsonText);
      } catch {
        toast.show('Error en el formato JSON del contexto de negocio.', {
          variant: 'error',
          title: 'JSON inválido',
        });
        setSaving(false);
        return;
      }

      await apiFetchJson(`/api/lines/${selectedLineId}/context`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessContext: parsedContext, systemPrompt: config.systemPrompt }),
      });
      const configPayload: Record<string, unknown> = {
        assignedAiProvider: config.assignedAiProvider,
        aiModel: config.aiModel,
      };
      if (newApiKey.trim()) configPayload.aiApiKey = newApiKey.trim();

      await apiFetchJson(`/api/lines/${selectedLineId}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configPayload),
      });
      if (newApiKey.trim()) {
        setConfig(prev => ({ ...prev, hasApiKey: true }));
        setNewApiKey('');
      }

      toast.show('Configuración guardada correctamente.', {
        variant: 'success',
        title: 'Guardado',
      });
    } catch {
      toast.show('Hubo un problema al guardar la configuración.', {
        variant: 'error',
        title: 'Error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleFormatJson = () => {
    try {
      setJsonText(JSON.stringify(JSON.parse(jsonText), null, 2));
    } catch {
      toast.show('No se puede formatear: el JSON tiene errores.', { variant: 'warning' });
    }
  };

  return (
    <section className="space-y-6">
      <div className="mb-6">
        <h1 className="text-heading-lg font-bold text-on-surface">Configuración de IA</h1>
        <p className="text-on-surface-variant text-body mt-1">Configura el comportamiento del asistente por línea</p>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Card variant="glass" padding="lg" className="animate-fade-in-up">
            <Card.Header>
              <div className="flex items-center gap-3">
                <Icon name="account_tree" size="md" filled className="text-secondary" />
                <h3 className="text-title font-semibold text-on-surface uppercase">Seleccionar línea</h3>
              </div>
            </Card.Header>
            <Card.Body>
              <FormSelect
                aria-label="Seleccionar línea"
                value={selectedLineId}
                onChange={(event) => setSelectedLineId(event.target.value)}
                disabled={lines.length === 0}
              >
                {lines.length === 0 && <option value="">No hay líneas disponibles</option>}
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </FormSelect>
            </Card.Body>
          </Card>

          <Card
            variant="glass"
            padding="lg"
            className="animate-fade-in-up"
            style={{ animationDelay: '60ms' }}
          >
            <Card.Header>
              <div className="flex items-center gap-3">
                <Icon name="psychology_alt" size="md" className="text-secondary" />
                <h3 className="text-title font-semibold text-on-surface uppercase">Personalidad y modelo</h3>
              </div>
            </Card.Header>
            <Card.Body className="gap-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormSelect
                  label="Proveedor de IA"
                  value={config.assignedAiProvider}
                  onChange={(event) => {
                    const provider = event.target.value;
                    const currentModels = MODELS_BY_PROVIDER[provider] ?? [];
                    const currentModelValid = currentModels.some(m => m.value === config.aiModel);
                    setConfig({
                      ...config,
                      assignedAiProvider: provider,
                      aiModel: currentModelValid ? config.aiModel : RECOMMENDED_MODEL[provider],
                    });
                  }}
                >
                  <option value="gemini">Google Gemini</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic Claude</option>
                </FormSelect>

                <FormSelect
                  label="Modelo"
                  value={config.aiModel || RECOMMENDED_MODEL[config.assignedAiProvider] || ''}
                  onChange={(event) => setConfig({ ...config, aiModel: event.target.value })}
                >
                  {(MODELS_BY_PROVIDER[config.assignedAiProvider] ?? []).map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.badge ? `${model.label} ★` : model.label}
                    </option>
                  ))}
                </FormSelect>

                <div className="md:col-span-2 flex flex-col gap-1">
                  <FormInput
                    label="API Key (Opcional)"
                    type="password"
                    placeholder={config.hasApiKey ? '••••••••  (clave ya configurada)' : 'sk-…'}
                    value={newApiKey}
                    onChange={(event) => setNewApiKey(event.target.value)}
                    helperText={config.hasApiKey ? 'Ingresá una nueva clave para reemplazar la existente.' : 'Si se deja vacío, se usará la clave por defecto.'}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="system-prompt"
                    className="text-caption uppercase tracking-wider text-on-surface-variant"
                  >
                    Prompt del sistema
                  </label>
                  <span className="text-overline font-mono text-on-surface-variant/70">
                    {config.systemPrompt.length} / 4000
                  </span>
                </div>
                <textarea
                  id="system-prompt"
                  value={config.systemPrompt}
                  onChange={(event) =>
                    setConfig({ ...config, systemPrompt: event.target.value })
                  }
                  disabled={loading}
                  placeholder="Ej. Eres un asistente de ventas experto en seguros…"
                  className="w-full h-48 bg-white/70 backdrop-blur-xl border border-outline-variant/60 hover:border-action/40 focus:border-action rounded-xl p-4 text-body text-on-surface placeholder:text-on-surface-variant/70 focus-ring transition-all duration-250 ease-premium resize-y"
                />
              </div>
            </Card.Body>
          </Card>

          <Card
            variant="glass"
            padding="lg"
            className="animate-fade-in-up"
            style={{ animationDelay: '120ms' }}
          >
            <Card.Header>
              <div className="flex items-center gap-3">
                <Icon name="database" size="md" className="text-secondary" />
                <h3 className="text-title font-semibold text-on-surface uppercase">Contexto de negocio (JSON)</h3>
              </div>
              <Badge variant="success" size="sm">
                Datos dinámicos
              </Badge>
            </Card.Header>
            <Card.Body>
              <p className="text-body-sm text-on-surface-variant">
                Definí la información base que el bot usará para responder (precios, FAQs,
                horarios, etc.) en formato JSON.
              </p>
              <div className="relative">
                <div className="absolute top-3 right-3 z-10">
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon="format_align_left"
                    onClick={handleFormatJson}
                  >
                    Formatear
                  </Button>
                </div>
                <textarea
                  aria-label="Contexto de negocio JSON"
                  value={jsonText}
                  onChange={(event) => setJsonText(event.target.value)}
                  spellCheck={false}
                  placeholder='{ "empresa": "Mi Negocio", "servicios": [] }'
                  className="w-full h-80 bg-inverse-surface text-inverse-on-surface font-mono text-body-sm p-5 pt-14 rounded-2xl border border-outline-variant/40 focus-ring transition-all duration-250 ease-premium resize-y"
                />
              </div>
            </Card.Body>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          <Card
            variant="solid"
            padding="lg"
            className="bg-primary text-white border-none shadow-glass-xl relative overflow-hidden animate-fade-in-up"
            style={{ animationDelay: '180ms' }}
          >
            <div
              aria-hidden="true"
              className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"
            />
            <div className="relative flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Icon name="verified_user" size="md" className="text-white/80" />
                <h4 className="text-title font-semibold uppercase text-white">Guardar cambios</h4>
              </div>
              <p className="text-body-sm text-white/70">
                Los cambios se aplicarán instantáneamente a todas las conversaciones activas en
                esta línea.
              </p>
              <Button
                variant="secondary"
                size="lg"
                fullWidth
                loading={saving}
                disabled={!selectedLineId}
                leadingIcon={saving ? undefined : 'save'}
                onClick={handleSave}
                className="bg-white text-primary hover:bg-surface-container-low"
              >
                {saving ? 'Guardando…' : 'Guardar configuración'}
              </Button>
            </div>
          </Card>

          <Card
            variant="glass"
            padding="md"
            className="animate-fade-in-up"
            style={{ animationDelay: '240ms' }}
          >
            <Card.Header>
              <div className="flex items-center gap-2 text-on-surface-variant">
                <Icon name="info" size="sm" />
                <span className="text-caption uppercase tracking-wider">Consejos</span>
              </div>
            </Card.Header>
            <Card.Body>
              <ul className="space-y-2">
                {[
                  'Los modelos con ★ son los más recomendados para ventas autónomas.',
                  'GPT-4.1 y Gemini 2.5 Pro tienen el mejor function calling.',
                  'Modelos "Mini" o "Flash" son más rápidos pero menos precisos en herramientas complejas.',
                  'Evitá JSON de más de 50KB para mejor performance.',
                ].map((tip) => (
                  <li key={tip} className="flex gap-2 text-body-sm text-on-surface-variant">
                    <Icon name="check_circle" size="xs" className="text-success mt-0.5" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </Card.Body>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default AIConfiguration;
