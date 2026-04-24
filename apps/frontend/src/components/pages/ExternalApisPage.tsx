import { useEffect, useState } from 'react';
import { apiFetchJson, apiFetch } from '../../lib/apiClient';
import {
  Badge,
  Button,
  Card,
  FormInput,
  FormSelect,
  Icon,
  Modal,
  useToast,
  EmptyState,
} from '../ui';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExternalApi {
  id: string;
  lineId: string;
  name: string;
  baseUrl: string;
  method: 'GET' | 'POST' | 'PUT';
  headers: Record<string, string>;
  body?: string;
  outputKey?: string;
  username?: string;
  password?: string;
  isActive: boolean;
}

interface HeaderRow {
  key: string;
  value: string;
}

interface Line {
  id: string;
  name: string;
  phone?: string;
  status: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const METHOD_BADGE: Record<string, { variant: 'primary' | 'success' | 'warning'; label: string }> =
  {
    GET: { variant: 'primary', label: 'GET' },
    POST: { variant: 'success', label: 'POST' },
    PUT: { variant: 'warning', label: 'PUT' },
  };

function headersToRows(headers: Record<string, string>): HeaderRow[] {
  return Object.entries(headers).map(([key, value]) => ({ key, value }));
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    if (row.key.trim()) result[row.key.trim()] = row.value;
  }
  return result;
}

const EMPTY_FORM: Omit<ExternalApi, 'id' | 'lineId'> = {
  name: '',
  baseUrl: '',
  method: 'GET',
  headers: {},
  body: '',
  outputKey: '',
  username: '',
  password: '',
  isActive: true,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
  const config = METHOD_BADGE[method] ?? { variant: 'neutral' as const, label: method };
  return (
    <Badge variant={config.variant} size="sm">
      {config.label}
    </Badge>
  );
}

interface ApiCardProps {
  api: ExternalApi;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

function ApiCard({ api, onEdit, onDelete, onToggleActive }: ApiCardProps) {
  return (
    <Card variant="glass" padding="md" className="animate-fade-in-up">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-body font-semibold text-on-surface">{api.name}</span>
            <MethodBadge method={api.method} />
            {api.isActive ? (
              <Badge variant="success" size="sm">
                Activo
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                Inactivo
              </Badge>
            )}
          </div>
          <p className="text-body-sm text-on-surface-variant truncate" title={api.baseUrl}>
            {api.baseUrl}
          </p>
          {api.outputKey && (
            <p className="text-overline text-on-surface-variant/70">
              Output: <span className="font-mono">{api.outputKey}</span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleActive}
            aria-label={api.isActive ? 'Desactivar API' : 'Activar API'}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-250 focus-ring"
            style={{ backgroundColor: api.isActive ? 'var(--color-primary)' : 'var(--color-outline-variant)' }}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-250 ${api.isActive ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
          <Button variant="ghost" size="sm" leadingIcon="edit" onClick={onEdit} aria-label="Editar">
            Editar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="delete"
            onClick={onDelete}
            aria-label="Eliminar"
            className="text-error hover:bg-error-container"
          >
            Eliminar
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── API Form Panel ───────────────────────────────────────────────────────────

interface ApiFormPanelProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  lineId: string;
  editing: ExternalApi | null;
}

function ApiFormPanel({ open, onClose, onSaved, lineId, editing }: ApiFormPanelProps) {
  const toast = useToast();
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([]);
  const [showAuth, setShowAuth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    status: number;
    body: unknown;
    extracted?: unknown;
  } | null>(null);

  // Sync form when editing entry changes
  useEffect(() => {
    if (editing) {
      const { id, lineId: _lid, ...rest } = editing;
      void id;
      setForm({ ...rest });
      setHeaderRows(headersToRows(editing.headers));
      setShowAuth(!!editing.username);
    } else {
      setForm({ ...EMPTY_FORM });
      setHeaderRows([]);
      setShowAuth(false);
    }
    setTestResult(null);
  }, [editing, open]);

  const updateForm = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addHeader = () => setHeaderRows((rows) => [...rows, { key: '', value: '' }]);
  const removeHeader = (idx: number) => setHeaderRows((rows) => rows.filter((_, i) => i !== idx));
  const updateHeader = (idx: number, field: 'key' | 'value', val: string) =>
    setHeaderRows((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const buildPayload = () => ({
    name: form.name.trim(),
    baseUrl: form.baseUrl.trim(),
    method: form.method,
    headers: rowsToHeaders(headerRows),
    body: form.body?.trim() || undefined,
    outputKey: form.outputKey?.trim() || undefined,
    username: form.username?.trim() || undefined,
    password: form.password || undefined,
    isActive: form.isActive,
  });

  const handleSave = async () => {
    if (!form.name.trim() || !form.baseUrl.trim()) {
      toast.show('Nombre y URL base son requeridos.', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (editing) {
        await apiFetchJson(`/api/lines/${lineId}/external-apis/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetchJson(`/api/lines/${lineId}/external-apis`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }
      toast.show(editing ? 'API actualizada.' : 'API creada.', { variant: 'success' });
      onSaved();
    } catch {
      toast.show('Error al guardar. Verifica los datos.', { variant: 'error', title: 'Error' });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!form.baseUrl.trim()) {
      toast.show('Ingresa una URL base para probar.', { variant: 'warning' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const payload = buildPayload();
      const res = await apiFetch(
        `/api/lines/${lineId}/external-apis/preview/test`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      setTestResult(json);
    } catch (err) {
      toast.show('Error al ejecutar la prueba.', { variant: 'error' });
    } finally {
      setTesting(false);
    }
  };

  const showBody = form.method === 'POST' || form.method === 'PUT';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Editar API: ${editing.name}` : 'Nueva API Externa'}
      size="lg"
    >
      <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
        {/* Basic fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormInput
            label="Nombre"
            placeholder="Ej. Inventario"
            value={form.name}
            onChange={(e) => updateForm('name', e.target.value)}
            required
          />
          <FormSelect
            label="Método"
            value={form.method}
            onChange={(e) => updateForm('method', e.target.value as 'GET' | 'POST' | 'PUT')}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
          </FormSelect>
        </div>

        <FormInput
          label="URL Base"
          placeholder="https://api.ejemplo.com/productos"
          value={form.baseUrl}
          onChange={(e) => updateForm('baseUrl', e.target.value)}
          required
        />

        <FormInput
          label="Output Key"
          placeholder="data.products"
          value={form.outputKey ?? ''}
          onChange={(e) => updateForm('outputKey', e.target.value)}
          helperText="Ruta para extraer del JSON de respuesta (ej: data.results)"
        />

        {/* Headers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-caption uppercase tracking-wider text-on-surface-variant">
              Headers personalizados
            </label>
            <Button variant="ghost" size="sm" leadingIcon="add" onClick={addHeader}>
              Agregar header
            </Button>
          </div>
          {headerRows.length === 0 && (
            <p className="text-body-sm text-on-surface-variant/60 italic">Sin headers.</p>
          )}
          {headerRows.map((row, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="text"
                aria-label={`Header key ${idx + 1}`}
                placeholder="Nombre"
                value={row.key}
                onChange={(e) => updateHeader(idx, 'key', e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <input
                type="text"
                aria-label={`Header value ${idx + 1}`}
                placeholder="Valor"
                value={row.value}
                onChange={(e) => updateHeader(idx, 'value', e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg border border-outline-variant/40 bg-surface text-on-surface text-body-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                aria-label="Eliminar header"
                onClick={() => removeHeader(idx)}
                className="p-2 rounded-lg hover:bg-error/8 text-error transition-colors"
              >
                <Icon name="close" size="sm" />
              </button>
            </div>
          ))}
        </div>

        {/* Body (POST/PUT only) */}
        {showBody && (
          <div className="space-y-1">
            <label className="text-caption uppercase tracking-wider text-on-surface-variant">
              Body (JSON)
            </label>
            <textarea
              aria-label="Body JSON"
              value={form.body ?? ''}
              onChange={(e) => updateForm('body', e.target.value)}
              placeholder={'{"query": "{{message}}", "limit": 10}'}
              rows={4}
              className="w-full bg-inverse-surface text-inverse-on-surface font-mono text-body-sm p-4 rounded-2xl border border-outline-variant/40 focus-ring transition-all duration-250 resize-y"
            />
            <p className="text-overline text-on-surface-variant/70">
              Usa {'{{message}}'} para incluir el mensaje del usuario
            </p>
          </div>
        )}

        {/* Basic auth collapsible */}
        <div className="rounded-xl border border-outline-variant/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAuth((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-body-sm font-medium text-on-surface-variant hover:bg-surface-container-high/40 transition-colors duration-250 focus-ring"
          >
            <span className="flex items-center gap-2">
              <Icon name="lock" size="sm" />
              Autenticación básica
            </span>
            <Icon name={showAuth ? 'expand_less' : 'expand_more'} size="sm" />
          </button>
          {showAuth && (
            <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-4 bg-surface-container-low/40">
              <FormInput
                label="Usuario"
                placeholder="admin"
                value={form.username ?? ''}
                onChange={(e) => updateForm('username', e.target.value)}
              />
              <FormInput
                label="Contraseña"
                type="password"
                placeholder="••••••••"
                value={form.password ?? ''}
                onChange={(e) => updateForm('password', e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-xl">
          <span className="text-body text-on-surface">Activo</span>
          <button
            type="button"
            role="switch"
            aria-checked={form.isActive}
            onClick={() => updateForm('isActive', !form.isActive)}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-250 focus-ring"
            style={{ backgroundColor: form.isActive ? 'var(--color-primary)' : 'var(--color-outline-variant)' }}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-250 ${form.isActive ? 'translate-x-6' : 'translate-x-1'}`}
            />
          </button>
        </div>

        {/* Test result */}
        {testResult && (
          <div className="space-y-3">
            <div className={`rounded-xl p-4 flex items-center gap-2 ${testResult.status >= 200 && testResult.status < 300 ? 'bg-success-container text-on-success-container' : 'bg-error-container text-on-error-container'}`}>
              <Icon name={testResult.status >= 200 && testResult.status < 300 ? 'check_circle' : 'error'} size="sm" />
              <span className="text-body-sm font-semibold">
                HTTP {testResult.status} — {testResult.status >= 200 && testResult.status < 300 ? 'Éxito' : 'Error'}
              </span>
            </div>
            <div>
              <p className="text-overline uppercase text-on-surface-variant mb-1">Respuesta</p>
              <pre className="bg-inverse-surface text-inverse-on-surface font-mono text-body-sm rounded-xl p-4 overflow-auto max-h-48 whitespace-pre-wrap break-all">
                {JSON.stringify(testResult.body, null, 2)}
              </pre>
            </div>
            {testResult.extracted !== undefined && (
              <div className="p-3 bg-primary/10 rounded-xl border border-primary/20">
                <p className="text-overline uppercase text-primary mb-1">Valor extraído</p>
                <pre className="text-body-sm text-on-surface font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(testResult.extracted, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-2 pt-4 border-t border-outline-variant/30 mt-4">
        <Button variant="ghost" size="md" leadingIcon="science" onClick={handleTest} loading={testing}>
          Probar
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="md" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" leadingIcon="save" onClick={handleSave} loading={saving}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Delete Confirmation Modal ────────────────────────────────────────────────

interface DeleteConfirmProps {
  open: boolean;
  apiName: string;
  onCancel: () => void;
  onConfirm: () => void;
  deleting: boolean;
}

function DeleteConfirmModal({ open, apiName, onCancel, onConfirm, deleting }: DeleteConfirmProps) {
  return (
    <Modal open={open} onClose={onCancel} title="Eliminar API" size="sm">
      <p className="text-body text-on-surface mb-6">
        ¿Eliminar la API <span className="font-semibold">"{apiName}"</span>? Esta acción no se
        puede deshacer.
      </p>
      <div className="flex gap-2 justify-end">
        <Button variant="secondary" size="md" onClick={onCancel} disabled={deleting}>
          Cancelar
        </Button>
        <Button variant="danger" size="md" leadingIcon="delete" onClick={onConfirm} loading={deleting}>
          Eliminar
        </Button>
      </div>
    </Modal>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ExternalApisPage() {
  const toast = useToast();

  const [lines, setLines] = useState<Line[]>([]);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [apis, setApis] = useState<ExternalApi[]>([]);
  const [loadingApis, setLoadingApis] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingApi, setEditingApi] = useState<ExternalApi | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ExternalApi | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch lines on mount
  useEffect(() => {
    const fetchLines = async () => {
      try {
        const data = await apiFetchJson<{ lines: Line[] }>('/api/lines');
        setLines(data.lines ?? []);
        if (data.lines?.length > 0) setSelectedLineId(data.lines[0].id);
      } catch {
        // Lines fetch failure is non-fatal; show empty state.
      }
    };
    fetchLines();
  }, []);

  // Fetch APIs when line changes
  useEffect(() => {
    if (!selectedLineId) return;

    const fetchApis = async () => {
      setLoadingApis(true);
      try {
        const data = await apiFetchJson<{ apis: ExternalApi[] }>(
          `/api/lines/${selectedLineId}/external-apis`,
        );
        setApis(data.apis ?? []);
      } catch {
        setApis([]);
      } finally {
        setLoadingApis(false);
      }
    };
    fetchApis();
  }, [selectedLineId]);

  const reloadApis = async () => {
    if (!selectedLineId) return;
    setLoadingApis(true);
    try {
      const data = await apiFetchJson<{ apis: ExternalApi[] }>(
        `/api/lines/${selectedLineId}/external-apis`,
      );
      setApis(data.apis ?? []);
    } catch {
      setApis([]);
    } finally {
      setLoadingApis(false);
    }
  };

  const handleFormSaved = () => {
    setFormOpen(false);
    setEditingApi(null);
    reloadApis();
  };

  const handleEdit = (api: ExternalApi) => {
    setEditingApi(api);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingApi(null);
    setFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetchJson(
        `/api/lines/${selectedLineId}/external-apis/${deleteTarget.id}`,
        { method: 'DELETE' },
      );
      toast.show('API eliminada.', { variant: 'success' });
      setDeleteTarget(null);
      reloadApis();
    } catch {
      toast.show('Error al eliminar la API.', { variant: 'error' });
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (api: ExternalApi) => {
    try {
      const updated = { ...api, isActive: !api.isActive };
      await apiFetchJson(`/api/lines/${selectedLineId}/external-apis/${api.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: updated.isActive }),
      });
      setApis((prev) => prev.map((a) => (a.id === api.id ? updated : a)));
    } catch {
      toast.show('No se pudo cambiar el estado.', { variant: 'error' });
    }
  };

  const selectedLine = lines.find((l) => l.id === selectedLineId);

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-heading-lg font-bold text-on-surface">APIs externas</h1>
            <p className="text-on-surface-variant text-body mt-1">
              Conecta APIs para enriquecer el contexto del chatbot en tiempo real
            </p>
          </div>
          <Button
            variant="primary"
            onClick={handleAdd}
            disabled={!selectedLineId}
            leadingIcon="add"
          >
            Nueva API
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          {/* Line selector */}
          <Card variant="glass" padding="lg" className="animate-fade-in-up">
            <Card.Header>
              <div className="flex items-center gap-3">
                <Icon name="account_tree" size="md" filled className="text-secondary" />
                <h3 className="text-title font-semibold text-on-surface uppercase">Seleccionar línea</h3>
              </div>
              {selectedLine && (
                <Badge
                  variant={selectedLine.status === 'connected' ? 'success' : 'neutral'}
                  size="sm"
                >
                  {selectedLine.status}
                </Badge>
              )}
            </Card.Header>
            <Card.Body>
              <FormSelect
                aria-label="Seleccionar línea"
                value={selectedLineId}
                onChange={(e) => setSelectedLineId(e.target.value)}
                disabled={lines.length === 0}
              >
                {lines.length === 0 && (
                  <option value="">No hay líneas disponibles</option>
                )}
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                    {line.phone ? ` · ${line.phone}` : ''}
                  </option>
                ))}
              </FormSelect>
            </Card.Body>
          </Card>

          {/* API list */}
          <Card
            variant="glass"
            padding="lg"
            className="animate-fade-in-up"
            style={{ animationDelay: '60ms' }}
          >
            <Card.Header>
              <div className="flex items-center gap-3">
                <Icon name="api" size="md" className="text-secondary" />
                <h3 className="text-title font-semibold text-on-surface uppercase">APIs configuradas</h3>
                {apis.length > 0 && (
                  <Badge variant="primary" size="sm">
                    {apis.length}
                  </Badge>
                )}
              </div>
              <Button
                variant="primary"
                size="sm"
                leadingIcon="add"
                onClick={handleAdd}
                disabled={!selectedLineId}
              >
                Agregar API
              </Button>
            </Card.Header>
            <Card.Body>
              {loadingApis ? (
                <div className="space-y-3">
                  {[1, 2].map((n) => (
                    <div
                      key={n}
                      className="h-20 rounded-xl bg-surface-container-high/40 animate-pulse"
                    />
                  ))}
                </div>
              ) : apis.length === 0 ? (
                <EmptyState
                  icon="api"
                  title={selectedLineId ? 'Sin APIs configuradas' : 'Selecciona una línea'}
                  description={
                    selectedLineId
                      ? 'Agrega una API para que el chatbot consulte datos externos.'
                      : 'Elige una línea de WhatsApp para gestionar sus APIs externas.'
                  }
                  action={
                    selectedLineId ? (
                      <Button variant="primary" size="md" leadingIcon="add" onClick={handleAdd}>
                        Agregar API
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {apis.map((api) => (
                    <ApiCard
                      key={api.id}
                      api={api}
                      onEdit={() => handleEdit(api)}
                      onDelete={() => setDeleteTarget(api)}
                      onToggleActive={() => handleToggleActive(api)}
                    />
                  ))}
                </div>
              )}
            </Card.Body>
          </Card>
        </div>

        {/* Sidebar tips */}
        <div className="col-span-12 lg:col-span-4 space-y-6 lg:sticky lg:top-24">
          <Card
            variant="solid"
            padding="lg"
            className="bg-primary text-on-primary border-none shadow-glass-xl relative overflow-hidden animate-fade-in-up"
            style={{ animationDelay: '120ms' }}
          >
            <div
              aria-hidden="true"
              className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none"
            />
            <div className="relative flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Icon name="bolt" size="md" className="text-on-primary/80" />
                <h4 className="text-title font-semibold uppercase text-on-primary">Cómo funciona</h4>
              </div>
              <p className="text-body-sm text-on-primary/70">
                Cuando el chatbot recibe un mensaje, consulta las APIs activas y enriquece su
                contexto antes de responder.
              </p>
            </div>
          </Card>

          <Card
            variant="glass"
            padding="md"
            className="animate-fade-in-up"
            style={{ animationDelay: '180ms' }}
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
                  'Usa {{message}} en el body para incluir el texto del usuario.',
                  'Define un Output Key para extraer solo el dato relevante.',
                  'Prueba la API antes de guardar para confirmar que responde.',
                  'Las APIs inactivas no se consultan en conversaciones.',
                ].map((tip) => (
                  <li key={tip} className="flex gap-2 text-body-sm text-on-surface-variant">
                    <Icon name="check_circle" size="xs" className="text-success mt-0.5 shrink-0" />
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Form modal */}
      <ApiFormPanel
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingApi(null);
        }}
        onSaved={handleFormSaved}
        lineId={selectedLineId}
        editing={editingApi}
      />

      {/* Delete confirmation */}
      <DeleteConfirmModal
        open={!!deleteTarget}
        apiName={deleteTarget?.name ?? ''}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </section>
  );
}

export default ExternalApisPage;
