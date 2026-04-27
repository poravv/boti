// Generic configurable facturador (invoicing) HTTP adapter.
// Sends POST to baseUrl with X-Access-Key / X-Secret-Key headers.
// The bodyTemplate is a JSON object where {{FIELD}} placeholders are replaced at call time.

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

  async createInvoice(replacements: Record<string, string>): Promise<InvoiceResult> {
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

    return {
      success: resp.ok,
      invoiceId: raw?.id ?? raw?.transactionId ?? raw?.invoiceId ?? raw?.numero,
      raw,
      statusCode: resp.status,
    };
  }

  // Recursively replace {{KEY}} placeholders in any nested JSON value
  private applyTemplate(template: unknown, replacements: Record<string, string>): unknown {
    if (typeof template === 'string') {
      return template.replace(/\{\{(\w+)\}\}/g, (_, key) => replacements[key] ?? `{{${key}}}`);
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
