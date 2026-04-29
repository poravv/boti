// SalesService — bridges core ISalesService port with PagoPar + Facturador infrastructure.
// Instantiated in index.ts and injected into HandleInboundMessage.

import { PrismaClient } from '@prisma/client';
import type { ISalesService, AIToolDef } from '@boti/core';
import { PagoParAdapter } from '../adapters/payments/PagoParAdapter.js';
import { FacturadorAdapter } from '../adapters/invoicing/FacturadorAdapter.js';

export class SalesService implements ISalesService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly backendBaseUrl: string,
  ) {}

  async isEnabledForLine(lineId: string): Promise<boolean> {
    const line = await this.prisma.whatsAppLine.findUnique({
      where: { id: lineId },
      select: { autonomousSalesEnabled: true },
    });
    return !!line?.autonomousSalesEnabled;
  }

  getToolDefinitions(): AIToolDef[] {
    return [
      {
        name: 'generate_payment_link',
        description:
          'Genera un link de pago seguro (PagoPar) y se lo enviás directamente al cliente en el chat. ' +
          'Usá esta herramienta cuando el cliente quiera pagar, contratar, activar un plan o pida el link — ' +
          'incluso si usa palabras como "quiero el plan", "facturame", "dame el link", "quiero comprarlo ya", "pagar ahora". ' +
          'NUNCA uses create_appointment para cobros: "contratar" o "activar" son compras, no citas de agenda. ' +
          'NUNCA escales al equipo humano para pagos de productos con precio fijo. ' +
          'NUNCA inventes, escribas ni simules un link de pago en texto — el link SIEMPRE sale de esta herramienta. ' +
          'Flujo OBLIGATORIO en este orden: ' +
          '1) Si no tenés el RUC o CI del cliente, preguntáselo: "¿Me podés dar tu RUC o CI para la factura?" — ' +
          '2) Una vez que el cliente te da su RUC/CI, llamá esta herramienta incluyendo ruc_receptor → ' +
          '3) Recibís una URL → enviásela al cliente: "Acá tenés tu link de pago: [URL]. Una vez que pagues te confirmamos." ' +
          'Si la herramienta retorna un error, avisale al cliente honestamente.',
        parameters: {
          type: 'object',
          properties: {
            producto: {
              type: 'string',
              description: 'Nombre del producto o servicio a cobrar',
            },
            monto: {
              type: 'number',
              description: 'Monto total en Guaraníes (PYG), sin decimales',
            },
            descripcion: {
              type: 'string',
              description: 'Descripción breve del pedido (opcional)',
            },
            ruc_receptor: {
              type: 'string',
              description:
                'RUC o CI del cliente para la factura. ' +
                'SIEMPRE pedíselo al cliente antes de llamar esta herramienta si no lo proporcionó en la conversación. ' +
                'Ejemplo de cómo pedirlo: "¿Me podés dar tu RUC o CI para emitir la factura?"',
            },
          },
          required: ['producto', 'monto'],
        },
      },
    ];
  }

  async executeTool(
    lineId: string,
    clientPhone: string,
    clientName: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (toolName !== 'generate_payment_link') {
      return `Herramienta "${toolName}" no disponible.`;
    }

    const config = await this.prisma.pagoParConfig.findUnique({ where: { lineId } });

    const producto = String(args.producto ?? 'Producto');
    const monto = Math.round(Number(args.monto ?? 0));
    const descripcion = args.descripcion ? String(args.descripcion) : producto;
    const receptorDocumento = args.ruc_receptor ? String(args.ruc_receptor) : null;

    if (monto <= 0) return 'El monto debe ser mayor a 0.';

    if (!config) {
      // No PagoPar configured — use internal payment simulator
      const { randomUUID } = await import('crypto');
      const saleId = randomUUID();
      const simulatorUrl = `${this.backendBaseUrl}/pay/${saleId}`;

      await this.prisma.saleRecord.create({
        data: {
          id: saleId,
          lineId,
          clientPhone,
          clientName: clientName || null,
          receptorDocumento,
          hashPedido: saleId,
          pagoParOrderId: null,
          paymentLinkUrl: simulatorUrl,
          amount: monto,
          currency: 'PYG',
          status: 'PENDING',
          items: [{ nombre: producto, cantidad: 1, precioUnitario: monto }],
        },
      });

      return simulatorUrl;
    }

    // Always use the auto-generated webhook URL tied to this lineId.
    // Prevents misconfiguration where a stored callbackUrl could point to another client's endpoint.
    const callbackUrl = `${this.backendBaseUrl}/api/webhook/pagopar/${lineId}`;
    const pagopar = new PagoParAdapter(config.publicKey, config.privateKey, config.sandboxMode, config.baseUrl ?? undefined);
    const orderId = `BOTI-${lineId.slice(0, 8)}-${Date.now()}`;

    const result = await pagopar.createPaymentOrder({
      orderId,
      totalAmount: monto,
      buyerName: clientName || clientPhone,
      buyerPhone: clientPhone,
      items: [{ name: producto, qty: 1, pricePerUnit: monto, description: descripcion }],
      callbackUrl,
    });

    await this.prisma.saleRecord.create({
      data: {
        lineId,
        clientPhone,
        clientName: clientName || null,
        receptorDocumento,
        hashPedido: result.hashPedido,
        pagoParOrderId: result.pagoParOrderId,
        paymentLinkUrl: result.paymentUrl,
        amount: monto,
        currency: 'PYG',
        status: 'PENDING',
        items: [{ nombre: producto, cantidad: 1, precioUnitario: monto }],
      },
    });

    return result.paymentUrl;
  }

  // Called from the PagoPar webhook handler in router.ts.
  // Returns the confirmed sale so the caller can send a WhatsApp confirmation.
  async handlePaymentConfirmation(
    lineId: string,
    hashPedido: string,
  ): Promise<{ clientPhone: string; amount: number; productName: string; invoiceId?: string } | null> {
    const sale = await this.prisma.saleRecord.findFirst({
      where: { hashPedido, lineId },
    });

    if (!sale || sale.status !== 'PENDING') return null;

    await this.prisma.saleRecord.update({
      where: { id: sale.id },
      data: { status: 'PAID', paidAt: new Date() },
    });

    const facturadorConfig = await this.prisma.facturadorConfig.findUnique({
      where: { lineId },
    });

    const items = Array.isArray(sale.items) ? sale.items as any[] : [];
    const productName: string = items[0]?.nombre ?? 'Venta WhatsApp';
    let invoiceId: string | undefined;

    if (!facturadorConfig || !facturadorConfig.isActive) {
      return { clientPhone: sale.clientPhone, amount: sale.amount, productName };
    }

    const facturador = new FacturadorAdapter({
      baseUrl: facturadorConfig.baseUrl,
      accessKey: facturadorConfig.accessKey,
      secretKey: facturadorConfig.secretKey,
      apiKey: facturadorConfig.apiKey,
      bodyTemplate: facturadorConfig.bodyTemplate as Record<string, unknown>,
    });

    const now = new Date().toISOString().replace('Z', '-03:00');

    const replacements: Record<string, string | number> = {
      TRANSACTION_ID: sale.id,
      PAGOPAR_ORDER_ID: sale.pagoParOrderId ?? sale.id,
      FECHA_EMISION: now,
      MONTO_TOTAL: sale.amount,                              // number → JSON number in template
      CLIENTE_TELEFONO: sale.clientPhone,                    // string → stays string
      CLIENTE_RUC: (sale as any).receptorDocumento ?? sale.clientPhone,
      CLIENTE_NOMBRE: (sale as any).clientName ?? sale.clientPhone,
      PRODUCTO: productName,
      CANTIDAD: Number(items[0]?.cantidad ?? 1),             // number → JSON number
      PRECIO_UNITARIO: Number(items[0]?.precioUnitario ?? sale.amount), // number → JSON number
    };

    try {
      const invoiceResult = await facturador.createInvoice(replacements);
      invoiceId = invoiceResult.invoiceId;

      await this.prisma.saleRecord.update({
        where: { id: sale.id },
        data: {
          status: invoiceResult.success ? 'INVOICED' : 'PAID',
          invoiceId: invoiceResult.invoiceId ?? null,
          invoicedAt: invoiceResult.success ? new Date() : null,
        },
      });
    } catch (err: any) {
      console.error(`[SalesService] Facturador error for sale ${sale.id}:`, err.message);
    }

    return { clientPhone: sale.clientPhone, amount: sale.amount, productName, invoiceId };
  }
}
