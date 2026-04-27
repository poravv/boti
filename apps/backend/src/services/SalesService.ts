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
      select: { autonomousSalesEnabled: true, pagoParConfig: { select: { id: true } } },
    });
    return !!(line?.autonomousSalesEnabled && line.pagoParConfig);
  }

  getToolDefinitions(): AIToolDef[] {
    return [
      {
        name: 'generate_payment_link',
        description:
          'Genera un link de pago de PagoPar para que el cliente pueda pagar de forma segura. ' +
          'Úsala SOLO cuando el cliente haya confirmado que quiere comprar y ya acordaron el precio.',
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
    if (!config) {
      return 'No hay configuración de PagoPar para esta línea.';
    }

    const producto = String(args.producto ?? 'Producto');
    const monto = Math.round(Number(args.monto ?? 0));
    const descripcion = args.descripcion ? String(args.descripcion) : producto;

    if (monto <= 0) {
      return 'El monto debe ser mayor a 0.';
    }

    const pagopar = new PagoParAdapter(config.publicKey, config.privateKey, config.sandboxMode);

    const orderId = `BOTI-${lineId.slice(0, 8)}-${Date.now()}`;
    const callbackUrl = `${this.backendBaseUrl}/webhook/pagopar/${lineId}`;

    const result = await pagopar.createPaymentOrder({
      orderId,
      totalAmount: monto,
      buyerName: clientName || clientPhone,
      buyerPhone: clientPhone,
      items: [{ name: producto, qty: 1, pricePerUnit: monto, description: descripcion }],
      callbackUrl: config.callbackUrl ?? callbackUrl,
    });

    // Persist sale record
    await this.prisma.saleRecord.create({
      data: {
        lineId,
        clientPhone,
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

    const replacements: Record<string, string> = {
      TRANSACTION_ID: sale.id,
      PAGOPAR_ORDER_ID: sale.pagoParOrderId ?? sale.id,
      FECHA_EMISION: now,
      MONTO_TOTAL: String(sale.amount),
      CLIENTE_TELEFONO: sale.clientPhone,
      PRODUCTO: productName,
      CANTIDAD: String(items[0]?.cantidad ?? 1),
      PRECIO_UNITARIO: String(items[0]?.precioUnitario ?? sale.amount),
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
