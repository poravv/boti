// PagoPar payment link adapter
// Docs: api.pagopar.com — POST /api/comercios/2.0/iniciar-transaccion
// Token: sha1(privateKey + orderId + amount_as_float_string)

import { createHash } from 'crypto';

export interface PagoParOrderResult {
  hashPedido: string;
  paymentUrl: string;
  pagoParOrderId: string;
}

export interface PagoParItem {
  name: string;
  qty: number;
  pricePerUnit: number;
  description?: string;
}

const PRODUCTION_BASE = 'https://api.pagopar.com';
const CHECKOUT_BASE = 'https://www.pagopar.com/pagos';

export class PagoParAdapter {
  constructor(
    private readonly publicKey: string,
    private readonly privateKey: string,
    private readonly sandboxMode: boolean = true,
    private readonly customBaseUrl?: string,
  ) {}

  private sha1(str: string): string {
    return createHash('sha1').update(str).digest('hex');
  }

  async createPaymentOrder(params: {
    orderId: string;
    totalAmount: number; // PYG integer
    buyerName: string;
    buyerPhone: string;
    buyerEmail?: string;
    items: PagoParItem[];
    callbackUrl?: string;
  }): Promise<PagoParOrderResult> {
    const { orderId, totalAmount, buyerName, buyerPhone, buyerEmail, items, callbackUrl } = params;

    // Token: sha1(privateKey + orderId + float(amount))
    const token = this.sha1(this.privateKey + orderId + String(parseFloat(totalAmount.toString())));

    // PagoPar requires a fecha_maxima_pago 24h from now
    const maxPayDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19);

    const cleanPhone = buyerPhone.replace(/\D/g, '');

    const body = {
      token,
      public_key: this.publicKey,
      monto_total: totalAmount,
      tipo_pedido: 'VENTA-COMERCIO',
      id_pedido_comercio: orderId,
      fecha_maxima_pago: maxPayDate,
      forma_pago: 9, // 9 = Bancard (cards) — client can change at checkout
      comprador: {
        nombre: buyerName,
        email: buyerEmail ?? `${cleanPhone}@boti.local`,
        telefono: cleanPhone,
        documento: cleanPhone.slice(-7) || '0000000',
        tipo_documento: 'CI',
        ciudad: null,
        ruc: null,
        direccion: '',
        coordenadas: '',
        razon_social: buyerName,
        direccion_referencia: null,
      },
      compras_items: items.map((item, i) => ({
        nombre: item.name,
        cantidad: item.qty,
        precio_total: item.pricePerUnit * item.qty,
        categoria: '909',
        ciudad: '1',
        public_key: this.publicKey,
        url_imagen: '',
        descripcion: item.description ?? item.name,
        id_producto: i + 1,
      })),
      ...(callbackUrl ? { url_notificacion: callbackUrl } : {}),
    };

    if (this.sandboxMode) {
      // In sandbox mode we simulate a successful response to avoid hitting real API
      // Remove this block and use real credentials when going to production
      const fakeHash = this.sha1(`sandbox:${orderId}:${Date.now()}`);
      return {
        hashPedido: fakeHash,
        paymentUrl: `${CHECKOUT_BASE}/${fakeHash}?sandbox=1`,
        pagoParOrderId: `SANDBOX-${orderId}`,
      };
    }

    const apiBase = this.customBaseUrl ?? PRODUCTION_BASE;
    const resp = await fetch(`${apiBase}/api/comercios/2.0/iniciar-transaccion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      throw new Error(`PagoPar HTTP error: ${resp.status}`);
    }

    const data = await resp.json() as any;

    if (!data.respuesta) {
      throw new Error(`PagoPar rejected order: ${JSON.stringify(data)}`);
    }

    const hashPedido: string = data.resultado[0].data;
    const pagoParOrderId: string = String(data.resultado[0].pedido);

    return {
      hashPedido,
      paymentUrl: `${CHECKOUT_BASE}/${hashPedido}`,
      pagoParOrderId,
    };
  }

  validateWebhookToken(hashPedido: string, receivedToken: string): boolean {
    return this.sha1(this.privateKey + hashPedido) === receivedToken;
  }
}
