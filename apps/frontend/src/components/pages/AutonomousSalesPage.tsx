import { useEffect, useState } from 'react';
import { apiFetchJson } from '../../lib/apiClient';
import { Badge, Button, Card, FormInput, Icon, useToast } from '../ui';

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
  apiKey: string;
  bodyTemplate: string; // JSON string for editing
  successExample: string; // JSON string for display
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

// ─── Default facturador body template ────────────────────────────────────────
const DEFAULT_BODY_TEMPLATE = JSON.stringify(
  {
    transactionId: '{{TRANSACTION_ID}}',
    emisorId: 'BOTI-01',
    fechaEmision: '{{FECHA_EMISION}}',
    header: {
      moneda: 'PYG',
      condicionPago: 'CONTADO',
      formaPago: 'TRANSFERENCIA',
    },
    emisor: {
      ruc: 'COMPLETAR-RUC',
      razonSocial: 'MI EMPRESA SA',
      timbrado: 'COMPLETAR',
      establecimiento: '001',
      puntoExpedicion: '001',
    },
    receptor: {
      tipoDocumento: 'CI',
      numeroDocumento: '{{CLIENTE_TELEFONO}}',
      razonSocial: 'CLIENTE WHATSAPP',
    },
    detail: [
      {
        codigo: 'PROD-001',
        descripcion: '{{PRODUCTO}}',
        cantidad: '{{CANTIDAD}}',
        precioUnitario: '{{PRECIO_UNITARIO}}',
        ivaTipo: '10',
      },
    ],
  },
  null,
  2,
);

// ─── Component ───────────────────────────────────────────────────────────────

export const AutonomousSalesPage = () => {
  const [lines, setLines] = useState<{ id: string; name: string }[]>([]);
  const [selectedLineId, setSelectedLineId] = useState('');
  const [salesEnabled, setSalesEnabled] = useState(false);
  const [hasFacturadorConfig, setHasFacturadorConfig] = useState(false);
  const [pagopar, setPagopar] = useState<PagoParFormState>({
    baseUrl: '',
    publicKey: '',
    privateKey: '',
    sandboxMode: true,
  });
  const [facturador, setFacturador] = useState<FacturadorFormState>({
    baseUrl: '',
    accessKey: '',
    secretKey: '',
    apiKey: '',
    bodyTemplate: DEFAULT_BODY_TEMPLATE,
    successExample: '',
    isActive: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'pagopar' | 'facturador'>('pagopar');
  const toast = useToast();

  // Load lines on mount
  useEffect(() => {
    apiFetchJson<{ lines: { id: string; name: string }[] }>('/api/lines')
      .then((d) => {
        setLines(d.lines || []);
        if (d.lines?.length > 0) setSelectedLineId(d.lines[0].id);
      })
      .catch(console.error);
  }, []);

  // Load config when line changes
  useEffect(() => {
    if (!selectedLineId) return;
    setLoading(true);

    apiFetchJson<SalesConfig>(`/api/lines/${selectedLineId}/sales-config`)
      .then((data) => {
        setSalesEnabled(data.autonomousSalesEnabled);

        if (data.pagoParConfig) {
          setPagopar({
            baseUrl: data.pagoParConfig.baseUrl ?? '',
            publicKey: data.pagoParConfig.publicKey,
            privateKey: '', // never pre-filled — secret
            sandboxMode: data.pagoParConfig.sandboxMode,
          });
        } else {
          setPagopar({ baseUrl: '', publicKey: '', privateKey: '', sandboxMode: true });
        }

        setHasFacturadorConfig(!!data.facturadorConfig);
        if (data.facturadorConfig) {
          setFacturador({
            baseUrl: data.facturadorConfig.baseUrl,
            accessKey: data.facturadorConfig.accessKey,
            secretKey: '', // never pre-filled — secret
            apiKey: data.facturadorConfig.apiKey ?? '',
            bodyTemplate: data.facturadorConfig.bodyTemplate
              ? JSON.stringify(data.facturadorConfig.bodyTemplate, null, 2)
              : DEFAULT_BODY_TEMPLATE,
            successExample: data.facturadorConfig.successExample
              ? JSON.stringify(data.facturadorConfig.successExample, null, 2)
              : '',
            isActive: data.facturadorConfig.isActive,
          });
        } else {
          setFacturador((prev) => ({ ...prev, baseUrl: '', accessKey: '', secretKey: '', apiKey: '' }));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedLineId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let bodyTemplateJson: unknown;
      try {
        bodyTemplateJson = JSON.parse(facturador.bodyTemplate);
      } catch {
        toast.show('El body template del facturador no es JSON válido.', { variant: 'error' });
        return;
      }

      let successExampleJson: unknown = null;
      if (facturador.successExample.trim()) {
        try {
          successExampleJson = JSON.parse(facturador.successExample);
        } catch {
          toast.show('El ejemplo de respuesta del facturador no es JSON válido.', { variant: 'error' });
          return;
        }
      }

      // Validate: first-time facturador config requires secretKey
      if (!hasFacturadorConfig && (facturador.baseUrl || facturador.accessKey) && !facturador.secretKey) {
        toast.show('Para guardar el facturador por primera vez, ingresá la X-Secret-Key.', { variant: 'error' });
        setSaving(false);
        return;
      }

      await apiFetchJson(`/api/lines/${selectedLineId}/sales-config`, {
        method: 'PUT',
        body: JSON.stringify({
          autonomousSalesEnabled: salesEnabled,
          pagoParConfig: {
            baseUrl: pagopar.baseUrl || null,
            publicKey: pagopar.publicKey,
            ...(pagopar.privateKey ? { privateKey: pagopar.privateKey } : {}),
            sandboxMode: pagopar.sandboxMode,
          },
          facturadorConfig: {
            baseUrl: facturador.baseUrl,
            accessKey: facturador.accessKey,
            ...(facturador.secretKey ? { secretKey: facturador.secretKey } : {}),
            apiKey: facturador.apiKey || null,
            bodyTemplate: bodyTemplateJson,
            successExample: successExampleJson,
            isActive: facturador.isActive,
          },
        }),
      });

      toast.show('Configuración guardada.', { variant: 'success' });
    } catch (err: any) {
      toast.show(err.message ?? 'Error al guardar.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ventas Autónomas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          El bot detecta intención de compra, genera links de pago y factura automáticamente.
        </p>
      </div>

      {/* Line selector */}
      <Card className="p-4">
        <label className="block text-sm font-medium text-foreground mb-2">Línea WhatsApp</label>
        <select
          value={selectedLineId}
          onChange={(e) => setSelectedLineId(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          {lines.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Card>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Toggle */}
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Icon name="storefront" className="text-primary" />
                  <span className="font-semibold text-foreground">Ventas autónomas</span>
                  <Badge variant={salesEnabled ? 'success' : 'neutral'}>
                    {salesEnabled ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Cuando está activo, el bot puede generar links de pago por sí solo al detectar una venta.
                </p>
              </div>
              <button
                onClick={() => setSalesEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                  salesEnabled ? 'bg-primary text-white' : 'bg-muted'
                }`}
                role="switch"
                aria-checked={salesEnabled}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                    salesEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </Card>

          {/* Tabs */}
          <div className="flex border-b border-border gap-4">
            {(['pagopar', 'facturador'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'pagopar' ? '💳 PagoPar' : '🧾 Facturador'}
              </button>
            ))}
          </div>

          {/* PagoPar Tab */}
          {activeTab === 'pagopar' && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="credit_card" className="text-primary" />
                <h2 className="font-semibold text-foreground">Configuración PagoPar</h2>
                <Badge variant={pagopar.sandboxMode ? 'warning' : 'success'} >
                  {pagopar.sandboxMode ? 'Sandbox (test)' : 'Producción'}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                Obtené tu public key y private key en PagoPar → <strong>Integrar con mi sitio web</strong>.
                El secret solo se muestra una vez al crearlo.
              </p>

              <div className="grid grid-cols-1 gap-4">
                <FormInput
                  label="Base URL de PagoPar (opcional)"
                  value={pagopar.baseUrl}
                  onChange={(e) => setPagopar((p) => ({ ...p, baseUrl: e.target.value }))}
                  placeholder="https://api.pagopar.com (dejar vacío para usar el predeterminado)"
                />
                <FormInput
                  label="Public Key"
                  value={pagopar.publicKey}
                  onChange={(e) => setPagopar((p) => ({ ...p, publicKey: e.target.value }))}
                  placeholder="63820974a40fe7c5c5c53c429af8b25bed599dbf"

                />
                <FormInput
                  label="Private Key"
                  type="password"
                  value={pagopar.privateKey}
                  onChange={(e) => setPagopar((p) => ({ ...p, privateKey: e.target.value }))}
                  placeholder="Dejar vacío para no cambiar"

                />
              </div>

              <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-xs text-muted-foreground">
                <Icon name="info" size="xs" className="inline mr-1 align-text-bottom" />
                Las notificaciones de pago se envían automáticamente al servidor de Boti. No es necesario configurar una URL de callback.
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setPagopar((p) => ({ ...p, sandboxMode: !p.sandboxMode }))}
                  className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                    pagopar.sandboxMode ? 'bg-warning' : 'bg-primary text-white'
                  }`}
                  role="switch"
                  aria-checked={!pagopar.sandboxMode}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                      pagopar.sandboxMode ? 'translate-x-0' : 'translate-x-5'
                    }`}
                  />
                </button>
                <span className="text-sm text-foreground">
                  {pagopar.sandboxMode
                    ? 'Modo sandbox activo — los links son de prueba'
                    : 'Modo producción — los links cobran dinero real'}
                </span>
              </div>

              {pagopar.sandboxMode && (
                <div className="rounded-lg bg-warning/10 border border-warning/30 p-3 text-xs text-warning-foreground space-y-1">
                  <p className="font-medium">Tarjetas de prueba PagoPar (Bancard vPOS):</p>
                  <p>Visa: <code className="bg-background/50 px-1 rounded">4000 0000 0000 0001</code> — venc. 12/30 — CVV 123</p>
                  <p>Mastercard: <code className="bg-background/50 px-1 rounded">5100 0000 0000 0000</code> — venc. 12/30 — CVV 123</p>
                </div>
              )}
            </Card>
          )}

          {/* Facturador Tab */}
          {activeTab === 'facturador' && (
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon name="receipt_long" className="text-primary" />
                  <h2 className="font-semibold text-foreground">Configuración Facturador</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Activo</span>
                  <button
                    onClick={() => setFacturador((f) => ({ ...f, isActive: !f.isActive }))}
                    className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      facturador.isActive ? 'bg-primary text-white' : 'bg-muted'
                    }`}
                    role="switch"
                    aria-checked={facturador.isActive}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                        facturador.isActive ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Se llama automáticamente después de confirmar un pago. Las claves se obtienen en el dashboard del facturador → <strong>Workspace → API Keys</strong>.
              </p>

              <div className="grid grid-cols-1 gap-4">
                <FormInput
                  label="Base URL (endpoint POST de facturación)"
                  value={facturador.baseUrl}
                  onChange={(e) => setFacturador((f) => ({ ...f, baseUrl: e.target.value }))}
                  placeholder="https://facturador.tuempresa.com/api/v1/facturas"
                 
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="X-Access-Key"
                    value={facturador.accessKey}
                    onChange={(e) => setFacturador((f) => ({ ...f, accessKey: e.target.value }))}
                    placeholder="tu-access-key"
                   
                  />
                  <FormInput
                    label="X-Secret-Key"
                    type="password"
                    value={facturador.secretKey}
                    onChange={(e) => setFacturador((f) => ({ ...f, secretKey: e.target.value }))}
                    placeholder="Dejar vacío para no cambiar"
                   
                  />
                </div>
                <FormInput
                  label="X-Api-Key (opcional)"
                  value={facturador.apiKey}
                  onChange={(e) => setFacturador((f) => ({ ...f, apiKey: e.target.value }))}
                  placeholder="Opcional — dejar vacío si no aplica"
                 
                />
              </div>

              {/* Body Template */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Body Template (JSON)
                </label>
                <p className="text-xs text-muted-foreground mb-2">
                  Usá placeholders: <code className="bg-muted px-1 rounded">{'{{TRANSACTION_ID}}'}</code>{' '}
                  <code className="bg-muted px-1 rounded">{'{{FECHA_EMISION}}'}</code>{' '}
                  <code className="bg-muted px-1 rounded">{'{{PRODUCTO}}'}</code>{' '}
                  <code className="bg-muted px-1 rounded">{'{{MONTO_TOTAL}}'}</code>{' '}
                  <code className="bg-muted px-1 rounded">{'{{CANTIDAD}}'}</code>{' '}
                  <code className="bg-muted px-1 rounded">{'{{PRECIO_UNITARIO}}'}</code>{' '}
                  <code className="bg-muted px-1 rounded">{'{{CLIENTE_TELEFONO}}'}</code>
                </p>
                <textarea
                  value={facturador.bodyTemplate}
                  onChange={(e) => setFacturador((f) => ({ ...f, bodyTemplate: e.target.value }))}
                  rows={16}
                  spellCheck={false}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                />
              </div>

              {/* Success Example */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Ejemplo de respuesta exitosa (opcional — referencia)
                </label>
                <textarea
                  value={facturador.successExample}
                  onChange={(e) => setFacturador((f) => ({ ...f, successExample: e.target.value }))}
                  rows={5}
                  spellCheck={false}
                  placeholder={'{\n  "id": "FAC-001",\n  "status": "ok"\n}'}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-y"
                />
              </div>
            </Card>
          )}

          {/* Save */}
          <div className="flex justify-end pb-8">
            <Button
              onClick={handleSave}
              disabled={saving || !selectedLineId}
              variant="primary"
              className="min-w-32"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Guardando…
                </span>
              ) : (
                'Guardar configuración'
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
