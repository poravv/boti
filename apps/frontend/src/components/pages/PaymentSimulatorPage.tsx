import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card } from '../ui';

interface SaleDetail {
  id: string;
  amount: number;
  currency: string;
  status: string;
  items: Array<{ nombre?: string; [key: string]: unknown }>;
  clientName: string | null;
  line: { name: string };
  alreadyPaid?: boolean;
}

export const PaymentSimulatorPage = () => {
  const { saleId } = useParams<{ saleId: string }>();
  const [sale, setSale] = useState<SaleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/pay/${saleId}`)
      .then(r => r.json())
      .then(data => {
        setSale(data);
        if (data.alreadyPaid || data.status !== 'PENDING') setPaid(true);
      })
      .catch(() => setError('No se pudo cargar el link de pago.'))
      .finally(() => setLoading(false));
  }, [saleId]);

  const handlePay = async () => {
    setPaying(true);
    try {
      const r = await fetch(`/api/pay/${saleId}/confirm`, { method: 'POST' });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? 'Error al confirmar el pago');
      setPaid(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-action/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 text-center max-w-sm">
          <p className="text-red-500">{error || 'Link no encontrado.'}</p>
        </Card>
      </div>
    );
  }

  const productName = sale.items[0]?.nombre ?? 'Producto';

  if (paid) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 text-center max-w-sm space-y-4">
          <div className="text-5xl">✅</div>
          <h1 className="text-xl font-bold text-foreground">¡Pago confirmado!</h1>
          <p className="text-muted-foreground">Vas a recibir un mensaje de confirmación por WhatsApp.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="p-8 max-w-sm w-full space-y-6">
        <div className="text-center space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{sale.line.name}</p>
          <h1 className="text-xl font-bold text-foreground">{productName}</h1>
        </div>
        <div className="rounded-lg bg-action/5 border border-action/20 p-4 text-center">
          <p className="text-3xl font-bold text-action">{sale.amount.toLocaleString('es-PY')} Gs.</p>
          <p className="text-xs text-muted-foreground mt-1">{sale.currency}</p>
        </div>
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3 text-xs text-yellow-700 dark:text-yellow-400 text-center">
          ⚠️ Modo simulador — no se realizará ningún cobro real
        </div>
        <Button onClick={handlePay} disabled={paying} variant="primary" fullWidth loading={paying}>
          {paying ? 'Procesando…' : 'Confirmar pago simulado'}
        </Button>
      </Card>
    </div>
  );
};
