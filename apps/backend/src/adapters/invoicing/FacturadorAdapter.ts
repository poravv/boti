// Generic configurable facturador (invoicing) HTTP adapter.
// Sends POST to baseUrl with X-Access-Key / X-Secret-Key headers.
// The bodyTemplate is a JSON object where {{FIELD}} placeholders are replaced at call time.
//
// Type coercion: if a replacement value is a number, a single-placeholder field (e.g. "{{MONTO}}")
// becomes a JSON number. String values always stay strings — no heuristic coercion.

export interface FacturadorConfig {
  baseUrl: string;
  accessKey: string;
  secretKey: string;
  apiKey?: string | null;
  bodyTemplate: Record<string, unknown>;
}

export interface InvoiceResult {
  success: boolean;
  invoiceId?: string;
  raw: unknown;
  statusCode: number;
}

export class FacturadorAdapter {
  constructor(private readonly config: FacturadorConfig) {}

  async createInvoice(replacements: Record<string, string | number>): Promise<InvoiceResult> {
    const body = this.applyTemplate(this.config.bodyTemplate, replacements);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Access-Key': this.config.accessKey,
      'X-Secret-Key': this.config.secretKey,
    };

    if (this.config.apiKey) {
      headers['X-Api-Key'] = this.config.apiKey;
    }

    const resp = await fetch(this.config.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const raw = await resp.json().catch(() => ({})) as any;

    // cdc = Código de Control SIFEN — the official document identifier.
    // Fall back to transactionId (our own ID echoed by the API) if cdc not present.
    const invoiceId: string | undefined =
      raw?.cdc ?? raw?.id ?? raw?.invoiceId ?? raw?.transactionId ?? undefined;

    return {
      success: resp.ok,
      invoiceId,
      raw,
      statusCode: resp.status,
    };
  }

  // Recursively replace {{KEY}} placeholders in any nested JSON value.
  // When the entire string value is a single {{KEY}} placeholder AND the replacement is a number,
  // the result is a JSON number — no heuristic coercion on partial strings.
  private applyTemplate(template: unknown, replacements: Record<string, string | number>): unknown {
    if (typeof template === 'string') {
      const single = template.match(/^\{\{(\w+)\}\}$/);
      if (single) {
        const val = replacements[single[1]];
        if (val !== undefined) return val; // preserves number or string type
        return template; // unknown key — leave as-is
      }
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) =>
        String(replacements[key] ?? `{{${key}}}`),
      );
    }
    if (Array.isArray(template)) {
      return template.map((item) => this.applyTemplate(item, replacements));
    }
    if (template && typeof template === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(template as Record<string, unknown>)) {
        result[k] = this.applyTemplate(v, replacements);
      }
      return result;
    }
    return template;
  }
}
