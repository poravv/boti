import { describe, it, expect } from 'vitest';
import { PagoParAdapter } from '../adapters/payments/PagoParAdapter.js';

const SANDBOX = new PagoParAdapter('pub-test', 'priv-test', true);

describe('PagoParAdapter — sandbox mode', () => {
  it('retorna una URL de checkout válida sin hacer HTTP', async () => {
    const result = await SANDBOX.createPaymentOrder({
      orderId: 'BOTI-TEST-001',
      totalAmount: 250000,
      buyerName: 'Andrés Vera',
      buyerPhone: '595992756462',
      items: [{ name: 'Web Express', qty: 1, pricePerUnit: 250000 }],
    });

    expect(result.paymentUrl).toMatch(/^https:\/\/www\.pagopar\.com\/pagos\//);
    expect(result.paymentUrl).toContain('sandbox=1');
    expect(result.hashPedido).toBeTruthy();
    expect(result.pagoParOrderId).toContain('SANDBOX');
  });

  it('hashPedido es único por orderId', async () => {
    const r1 = await SANDBOX.createPaymentOrder({
      orderId: 'ORDER-A',
      totalAmount: 150000,
      buyerName: 'Cliente A',
      buyerPhone: '595981000001',
      items: [{ name: 'Boti Básico', qty: 1, pricePerUnit: 150000 }],
    });
    const r2 = await SANDBOX.createPaymentOrder({
      orderId: 'ORDER-B',
      totalAmount: 150000,
      buyerName: 'Cliente B',
      buyerPhone: '595981000002',
      items: [{ name: 'Boti Básico', qty: 1, pricePerUnit: 150000 }],
    });

    expect(r1.hashPedido).not.toBe(r2.hashPedido);
    expect(r1.paymentUrl).not.toBe(r2.paymentUrl);
  });

  it('pagoParOrderId incluye el orderId original', async () => {
    const result = await SANDBOX.createPaymentOrder({
      orderId: 'BOTI-LINEID1-17774230',
      totalAmount: 380000,
      buyerName: 'Test',
      buyerPhone: '595981000099',
      items: [{ name: 'Boti Growth', qty: 1, pricePerUnit: 380000 }],
    });

    expect(result.pagoParOrderId).toContain('BOTI-LINEID1-17774230');
  });

  it('monto 0 no lanza error en sandbox (validación está en SalesService)', async () => {
    const result = await SANDBOX.createPaymentOrder({
      orderId: 'BOTI-ZERO',
      totalAmount: 0,
      buyerName: 'Test',
      buyerPhone: '595981000001',
      items: [{ name: 'Test', qty: 1, pricePerUnit: 0 }],
    });
    // Sandbox bypasses all validation — SalesService validates monto > 0 before calling this
    expect(result.paymentUrl).toBeTruthy();
  });

  it('validateWebhookToken funciona con hash correcto', () => {
    const adapter = new PagoParAdapter('pub', 'mi-clave-privada', true);
    const { createHash } = require('crypto');
    const hash = 'abc123hash';
    const expectedToken = createHash('sha1').update('mi-clave-privada' + hash).digest('hex');

    expect(adapter.validateWebhookToken(hash, expectedToken)).toBe(true);
    expect(adapter.validateWebhookToken(hash, 'token-invalido')).toBe(false);
  });
});
