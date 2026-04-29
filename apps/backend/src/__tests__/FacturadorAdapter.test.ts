import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FacturadorAdapter } from '../adapters/invoicing/FacturadorAdapter.js';

// ──────────────────────────────────────────────────────────────────────────────
// Template that matches the real API schema (discovered via curl exploration)
// ──────────────────────────────────────────────────────────────────────────────
const BODY_TEMPLATE = {
  transactionId: '{{TRANSACTION_ID}}',
  emisorId: 'Andres01',
  tipoDocumento: 'FACTURA',
  fechaEmision: '{{FECHA_EMISION}}',
  header: {
    moneda: 'PYG',
    condicionPago: 1,
    formaPago: 'CONTADO',
    montoTotal: '{{MONTO_TOTAL}}',
  },
  emisor: {
    ruc: '80012345-6',
    razonSocial: 'MI EMPRESA SA',
    nombreFantasia: 'Mi Empresa',
    timbrado: '12345678',
    establecimiento: '001',
    puntoExpedicion: '001',
    fechaVigenciaTimbrado: '2025-01-01',
    tipoContribuyente: 2,
    tipoRegimen: 8,
  },
  receptor: {
    tipoDocumento: 'CI',
    numeroDocumento: '{{CLIENTE_TELEFONO}}',
    razonSocial: '{{CLIENTE_NOMBRE}}',
  },
  detail: [
    {
      codigo: 'BOTI-VENTA',
      descripcion: '{{PRODUCTO}}',
      cantidad: '{{CANTIDAD}}',
      precioUnitario: '{{PRECIO_UNITARIO}}',
      ivaTipo: 1,
      ivaBase: 100,
      iva: 10,
    },
  ],
};

const BASE_REPLACEMENTS: Record<string, string | number> = {
  TRANSACTION_ID: 'BOTI-SALE-UUID-001',
  FECHA_EMISION: '2026-04-29T01:00:00-03:00',
  MONTO_TOTAL: 250000,          // number — will become JSON number
  CLIENTE_TELEFONO: '595992756462', // string — stays string
  CLIENTE_NOMBRE: 'Andrés Vera',
  PRODUCTO: 'Web Express',
  CANTIDAD: 1,                  // number
  PRECIO_UNITARIO: 250000,      // number
};

// ──────────────────────────────────────────────────────────────────────────────
// GROUP 1 — Template rendering (unit, no HTTP)
// ──────────────────────────────────────────────────────────────────────────────

describe('FacturadorAdapter — template rendering', () => {
  it('reemplaza todos los placeholders en el body', async () => {
    // Mock fetch to capture the body without making real HTTP calls
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cdc: 'CDC-TEST-001', transactionId: 'BOTI-SALE-UUID-001', estado: 'APROBADO' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new FacturadorAdapter({
      baseUrl: 'http://localhost:8081/api/v1/facturas',
      accessKey: 'ak_test',
      secretKey: 'sk_test',
      bodyTemplate: BODY_TEMPLATE,
    });

    await adapter.createInvoice(BASE_REPLACEMENTS);

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.transactionId).toBe('BOTI-SALE-UUID-001');
    expect(sentBody.fechaEmision).toBe('2026-04-29T01:00:00-03:00');
    expect(sentBody.receptor.numeroDocumento).toBe('595992756462');
    expect(sentBody.receptor.razonSocial).toBe('Andrés Vera');
    expect(sentBody.detail[0].descripcion).toBe('Web Express');

    vi.unstubAllGlobals();
  });

  it('convierte strings numéricos a números en el body enviado', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cdc: 'CDC-001', estado: 'APROBADO' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new FacturadorAdapter({
      baseUrl: 'http://localhost:8081/api/v1/facturas',
      accessKey: 'ak_test',
      secretKey: 'sk_test',
      bodyTemplate: BODY_TEMPLATE,
    });

    await adapter.createInvoice(BASE_REPLACEMENTS);

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(typeof sentBody.header.montoTotal).toBe('number');
    expect(sentBody.header.montoTotal).toBe(250000);
    expect(typeof sentBody.detail[0].cantidad).toBe('number');
    expect(sentBody.detail[0].cantidad).toBe(1);
    expect(typeof sentBody.detail[0].precioUnitario).toBe('number');
    expect(sentBody.detail[0].precioUnitario).toBe(250000);

    vi.unstubAllGlobals();
  });

  it('preserva valores estáticos no-placeholder intactos', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cdc: 'CDC-001' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new FacturadorAdapter({
      baseUrl: 'http://localhost:8081/api/v1/facturas',
      accessKey: 'ak_test',
      secretKey: 'sk_test',
      bodyTemplate: BODY_TEMPLATE,
    });

    await adapter.createInvoice(BASE_REPLACEMENTS);

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.emisorId).toBe('Andres01');
    expect(sentBody.tipoDocumento).toBe('FACTURA');
    expect(sentBody.header.moneda).toBe('PYG');
    expect(sentBody.header.condicionPago).toBe(1);
    expect(sentBody.emisor.ruc).toBe('80012345-6');
    expect(sentBody.detail[0].ivaTipo).toBe(1);
    expect(sentBody.detail[0].ivaBase).toBe(100);

    vi.unstubAllGlobals();
  });

  it('placeholder sin reemplazo queda como literal {{KEY}}', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new FacturadorAdapter({
      baseUrl: 'http://localhost:8081/api/v1/facturas',
      accessKey: 'ak_test',
      secretKey: 'sk_test',
      bodyTemplate: { campo: '{{CAMPO_DESCONOCIDO}}' },
    });

    await adapter.createInvoice({});

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.campo).toBe('{{CAMPO_DESCONOCIDO}}');

    vi.unstubAllGlobals();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GROUP 2 — Headers HTTP enviados correctamente
// ──────────────────────────────────────────────────────────────────────────────

describe('FacturadorAdapter — HTTP headers', () => {
  it('envía X-Access-Key y X-Secret-Key en los headers', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ cdc: 'CDC-001' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new FacturadorAdapter({
      baseUrl: 'http://localhost:8081/api/v1/facturas',
      accessKey: 'ak_d24347e855a54f14bee20728b7836e30',
      secretKey: 'sk_f7aa01318084484fa1550dab0dd5190a',
      bodyTemplate: {},
    });

    await adapter.createInvoice({});

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-Access-Key']).toBe('ak_d24347e855a54f14bee20728b7836e30');
    expect(headers['X-Secret-Key']).toBe('sk_f7aa01318084484fa1550dab0dd5190a');
    expect(headers['Content-Type']).toBe('application/json');

    vi.unstubAllGlobals();
  });

  it('NO envía X-Api-Key si apiKey es undefined', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapter = new FacturadorAdapter({
      baseUrl: 'http://localhost:8081/api/v1/facturas',
      accessKey: 'ak_test',
      secretKey: 'sk_test',
      bodyTemplate: {},
    });

    await adapter.createInvoice({});

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers['X-Api-Key']).toBeUndefined();

    vi.unstubAllGlobals();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GROUP 3 — Extracción de invoiceId desde respuesta
// ──────────────────────────────────────────────────────────────────────────────

describe('FacturadorAdapter — invoiceId extraction', () => {
  const cases = [
    {
      desc: 'usa cdc como invoiceId (respuesta SIFEN estándar)',
      raw: { cdc: '01800123456001001000000922026042917646735502', transactionId: 'BOTI-001', estado: 'APROBADO' },
      expected: '01800123456001001000000922026042917646735502',
    },
    {
      desc: 'fallback a id cuando no hay cdc',
      raw: { id: 'INV-007', transactionId: 'BOTI-001' },
      expected: 'INV-007',
    },
    {
      desc: 'fallback a transactionId cuando no hay cdc ni id',
      raw: { transactionId: 'BOTI-001' },
      expected: 'BOTI-001',
    },
    {
      desc: 'invoiceId undefined cuando la respuesta está vacía',
      raw: {},
      expected: undefined,
    },
  ];

  it.each(cases)('$desc', async ({ raw, expected }) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => raw,
    }));

    const adapter = new FacturadorAdapter({
      baseUrl: 'http://localhost:8081/api/v1/facturas',
      accessKey: 'ak_test',
      secretKey: 'sk_test',
      bodyTemplate: {},
    });

    const result = await adapter.createInvoice({});
    expect(result.invoiceId).toBe(expected);

    vi.unstubAllGlobals();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// GROUP 4 — Integración real con facturador en Docker (localhost:8081)
// ──────────────────────────────────────────────────────────────────────────────

describe('FacturadorAdapter — integración real (Docker localhost:8081)', () => {
  const adapter = new FacturadorAdapter({
    baseUrl: 'http://localhost:8081/api/v1/facturas',
    accessKey: 'ak_d24347e855a54f14bee20728b7836e30',
    secretKey: 'sk_f7aa01318084484fa1550dab0dd5190a',
    bodyTemplate: BODY_TEMPLATE,
  });

  const replacements = {
    ...BASE_REPLACEMENTS,
    TRANSACTION_ID: `BOTI-VITEST-${Date.now()}`,
  };

  it('la API responde con status 200 y estructura JSON válida', async () => {
    const result = await adapter.createInvoice(replacements);

    expect(result.statusCode).toBe(200);
    expect(result.raw).toBeTruthy();
    const raw = result.raw as any;
    expect(raw).toHaveProperty('transactionId');
    expect(raw).toHaveProperty('estado');
    expect(raw).toHaveProperty('total');
    expect(raw.total).toBe(250000);
  }, 10000);

  it('la respuesta incluye cdc (identificador SIFEN)', async () => {
    const result = await adapter.createInvoice({
      ...replacements,
      TRANSACTION_ID: `BOTI-VITEST-CDC-${Date.now()}`,
    });

    const raw = result.raw as any;
    expect(raw.cdc).toBeTruthy();
    // CDC format: starts with "01" prefix (tipo documento)
    expect(raw.cdc).toMatch(/^\d+/);
  }, 10000);

  it('invoiceId extraído es el cdc de la respuesta', async () => {
    const result = await adapter.createInvoice({
      ...replacements,
      TRANSACTION_ID: `BOTI-VITEST-ID-${Date.now()}`,
    });

    const raw = result.raw as any;
    if (raw.cdc) {
      expect(result.invoiceId).toBe(raw.cdc);
    }
  }, 10000);

  it('el body enviado tiene tipos correctos (no strings para montos)', async () => {
    // We verify via a fresh call and check the API doesn't reject with type errors
    const result = await adapter.createInvoice({
      ...replacements,
      TRANSACTION_ID: `BOTI-VITEST-TYPES-${Date.now()}`,
    });

    // 400 would indicate validation errors (e.g. wrong types)
    expect(result.statusCode).not.toBe(400);
  }, 10000);
});
