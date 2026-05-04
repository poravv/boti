import { useEffect, useMemo, useState } from 'react';
import { apiFetchJson } from '../../lib/apiClient';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Modal,
  Skeleton,
  cn,
  useToast,
} from '../ui';

interface Stats {
  activeLines: number;
  totalMessages: number;
  totalLeads: number;
  messagesToday: number;
  leadsTrend: string;
  performance: string;
  hourlyTraffic: number[];
}

interface AuditLog {
  action: string;
  details: unknown;
  createdAt: string;
}

type StatTone = 'primary' | 'success' | 'warning' | 'info';

const INITIAL_STATS: Stats = {
  activeLines: 0,
  totalMessages: 0,
  totalLeads: 0,
  messagesToday: 0,
  leadsTrend: '0%',
  performance: '0%',
  hourlyTraffic: [],
};

const TONE_ICON_CLASSES: Record<StatTone, string> = {
  primary: 'bg-primary/10 text-primary border-primary/10',
  success: 'bg-success/10 text-success border-success/10',
  warning: 'bg-warning/10 text-warning border-warning/10',
  info: 'bg-primary/10 text-primary border-primary/10',
};

export function Dashboard() {
  const [stats, setStats] = useState<Stats>(INITIAL_STATS);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLogModal, setShowLogModal] = useState(false);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const [statsData, logsData] = await Promise.all([
          apiFetchJson<any>('/api/stats'),
          apiFetchJson<any>('/api/audit-logs'),
        ]);
        if (!mounted) return;
        setStats({ ...INITIAL_STATS, ...statsData });
        setLogs(logsData.logs || []);
      } catch {
        // Silent failure
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const mainStats = useMemo(() => [
    {
      id: 'active-lines',
      title: 'Líneas Activas',
      value: stats.activeLines,
      icon: 'hub',
      tone: 'primary' as const,
      delta: '+2.4%',
      desc: 'Sincronización en tiempo real'
    },
    {
      id: 'total-messages',
      title: 'Mensajes Totales',
      value: stats.totalMessages.toLocaleString(),
      icon: 'chat_bubble',
      tone: 'success' as const,
      delta: stats.performance,
      desc: 'Interacciones exitosas'
    },
    {
      id: 'total-leads',
      title: 'Leads Generados',
      value: stats.totalLeads,
      icon: 'person_add',
      tone: 'warning' as const,
      delta: stats.leadsTrend,
      desc: 'Potenciales ventas'
    },
    {
      id: 'traffic-now',
      title: 'Tráfico (Hoy)',
      value: stats.messagesToday,
      icon: 'trending_up',
      tone: 'info' as const,
      delta: '+12%',
      desc: 'Carga de mensajes'
    }
  ], [stats]);

  if (loading) {
    return (
      <div className="space-y-8 animate-in">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="lg:col-span-2 h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">Bienvenido de nuevo</h1>
        <p className="text-muted-foreground mt-2 font-medium">Esto es lo que está pasando con tu negocio hoy.</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {mainStats.map((stat) => (
          <Card key={stat.id} variant="solid" className="relative overflow-hidden group">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">{stat.title}</p>
                <h3 className="text-2xl font-black text-foreground mt-2">{stat.value}</h3>
              </div>
              <div className={cn(
                "p-3 rounded-xl border transition-all duration-300 group-hover:scale-110",
                TONE_ICON_CLASSES[stat.tone]
              )}>
                <Icon name={stat.icon} size="md" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
                {stat.delta}
              </span>
              <span className="text-[10px] text-muted-foreground font-semibold">{stat.desc}</span>
            </div>
            {/* Decoration */}
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 group-hover:rotate-12">
              <Icon name={stat.icon} size="xl" className="w-24 h-24" />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Traffic Chart */}
        <Card variant="solid" className="lg:col-span-2">
          <Card.Header>
            <div className="flex justify-between items-center w-full">
              <div>
                <h3 className="text-lg font-bold text-foreground">Tráfico por Hora</h3>
                <p className="text-xs text-muted-foreground font-medium">Mensajes procesados hoy</p>
              </div>
              <Badge variant="primary" size="sm" className="animate-pulse">Real-time</Badge>
            </div>
          </Card.Header>
          <Card.Body>
            <div className="h-[250px] flex items-end justify-between gap-1.5 px-2 pb-2 border-l border-b border-border/50">
              {(stats.hourlyTraffic?.length ? stats.hourlyTraffic : Array.from({length: 24}, () => Math.floor(Math.random() * 100))).map((val, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-primary/20 hover:bg-primary/50 transition-all duration-300 rounded-t-sm group relative"
                  style={{ height: `${Math.max(val, 5)}%` }}
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold px-2 py-1 rounded shadow-premium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-above">
                    {val} mensajes
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-4 text-[10px] text-muted-foreground font-bold uppercase tracking-[0.1em] px-1">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>23:59</span>
            </div>
          </Card.Body>
        </Card>

        {/* Audit Log Preview */}
        <Card variant="solid" className="flex flex-col">
          <Card.Header>
            <div className="flex justify-between items-center w-full">
              <h3 className="text-lg font-bold text-foreground">Actividad</h3>
              <Button variant="ghost" size="sm" className="text-xs font-bold" onClick={() => setShowLogModal(true)}>VER TODO</Button>
            </div>
          </Card.Header>
          <Card.Body className="p-0 overflow-y-auto max-h-[350px] custom-scrollbar">
            {logs.length === 0 ? (
              <EmptyState title="Sin actividad" description="No hay registros recientes" icon="history" className="py-10" />
            ) : (
              <div className="divide-y divide-border/50">
                {logs.slice(0, 10).map((log, i) => (
                  <div key={i} className="p-4 hover:bg-muted/30 transition-colors flex gap-4 group">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                      <Icon name="history" size="xs" className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">{log.action}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-medium flex items-center gap-2">
                        <Icon name="schedule" size="xs" />
                        {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card.Body>
        </Card>
      </div>

      <Modal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        title="Historial de Auditoría"
        size="lg"
      >
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-premium">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-bold uppercase text-[10px] tracking-[0.15em]">
                <tr>
                  <th className="px-6 py-5">Acción</th>
                  <th className="px-6 py-5">Detalles</th>
                  <th className="px-6 py-5 text-right">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {logs.map((log, i) => (
                  <tr key={i} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">{log.action}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                      </code>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground text-right font-medium">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default Dashboard;
