import { useEffect, useMemo, useState } from 'react';
import { apiFetchJson } from '../../lib/apiClient';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Modal,
  SkeletonCard,
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

interface StatDefinition {
  id: string;
  title: string;
  value: number | string;
  icon: string;
  tone: StatTone;
  deltaLabel: string;
  deltaVariant: 'success' | 'warning' | 'neutral' | 'primary';
}

const TONE_ICON_CLASSES: Record<StatTone, string> = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success-container text-on-success-container',
  warning: 'bg-warning-container text-on-warning-container',
  info: 'bg-info-container text-on-info-container',
};

const INITIAL_STATS: Stats = {
  activeLines: 0,
  totalMessages: 0,
  totalLeads: 0,
  messagesToday: 0,
  leadsTrend: '0%',
  performance: '0%',
  hourlyTraffic: [],
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
        // Silent failure mirrors legacy behavior; UI shows empty states.
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

  const hourlyTraffic = stats.hourlyTraffic?.length
    ? stats.hourlyTraffic
    : Array.from({ length: 15 }, () => 0);
  const maxTraffic = Math.max(...hourlyTraffic, 10);

  const secondaryStats = useMemo<StatDefinition[]>(
    () => [
      {
        id: 'active-lines',
        title: 'Líneas activas',
        value: stats.activeLines,
        icon: 'bolt',
        tone: 'success',
        deltaLabel: 'En línea',
        deltaVariant: 'success',
      },
      {
        id: 'total-leads',
        title: 'Contactos totales',
        value: stats.totalLeads,
        icon: 'psychology',
        tone: 'warning',
        deltaLabel: 'Crecimiento',
        deltaVariant: 'warning',
      },
      {
        id: 'performance',
        title: 'Rendimiento',
        value: stats.performance || '0%',
        icon: 'trending_up',
        tone: 'info',
        deltaLabel: 'Saludable',
        deltaVariant: 'primary',
      },
    ],
    [stats.activeLines, stats.totalLeads, stats.performance],
  );

  return (
    <section className="space-y-6">
      <div className="mb-6">
        <h1 className="text-heading-lg font-bold text-on-surface">Panel principal</h1>
        <p className="text-on-surface-variant text-body mt-1">
          Resumen de actividad en tiempo real
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-12 auto-rows-[minmax(160px,auto)] gap-6">
          <SkeletonCard className="col-span-12 md:col-span-6 lg:col-span-5 row-span-2 min-h-[320px]" />
          <SkeletonCard className="col-span-12 md:col-span-6 lg:col-span-7" />
          <SkeletonCard className="col-span-12 md:col-span-4 lg:col-span-3" />
          <SkeletonCard className="col-span-12 md:col-span-4 lg:col-span-2" />
          <SkeletonCard className="col-span-12 md:col-span-4 lg:col-span-2" />
          <SkeletonCard className="col-span-12 lg:col-span-7 min-h-[300px]" />
          <SkeletonCard className="col-span-12 lg:col-span-5 min-h-[300px]" />
        </div>
      ) : (
        <div className="grid grid-cols-12 auto-rows-[minmax(160px,auto)] gap-4 md:gap-6">
          <HeroStatCard
            delay={0}
            value={stats.messagesToday}
            trend={stats.leadsTrend}
            hourlyTraffic={hourlyTraffic}
            maxTraffic={maxTraffic}
          />

          {secondaryStats.map((stat, index) => (
            <StatTile
              key={stat.id}
              stat={stat}
              delay={(index + 1) * 60}
              className={cn(
                'col-span-12 md:col-span-4',
                index === 0 && 'lg:col-span-3',
                index === 1 && 'lg:col-span-2',
                index === 2 && 'lg:col-span-2',
              )}
            />
          ))}

          <TrafficCard
            hourlyTraffic={hourlyTraffic}
            maxTraffic={maxTraffic}
            total={stats.totalMessages}
            delay={240}
          />

          <ActivityCard
            logs={logs.slice(0, 5)}
            total={logs.length}
            onOpenAudit={() => setShowLogModal(true)}
            delay={300}
          />

          <PlanUsageCard />
        </div>
      )}

      <Modal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        size="lg"
        title="Historial de auditoría"
        description="Historial completo de eventos del sistema."
      >
        {logs.length === 0 ? (
          <EmptyState
            icon="history"
            title="Sin eventos registrados"
            description="Todavía no hay actividad en el sistema."
          />
        ) : (
          <ul className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
            {logs.map((log, index) => (
              <li
                key={index}
                className="flex gap-3 p-4 rounded-2xl bg-surface-container-low/80 border border-outline-variant/40 animate-fade-in-up"
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                  <Icon name="history" size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-body-sm font-semibold text-on-surface">{log.action}</p>
                    <Badge variant="neutral" size="sm">
                      {new Date(log.createdAt).toLocaleString()}
                    </Badge>
                  </div>
                  <p className="text-caption text-on-surface-variant break-words font-mono">
                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </section>
  );
}

interface HeroStatCardProps {
  value: number;
  trend: string;
  hourlyTraffic: number[];
  maxTraffic: number;
  delay: number;
}

function HeroStatCard({ value, trend, hourlyTraffic, maxTraffic, delay }: HeroStatCardProps) {
  return (
    <Card
      variant="glass-elevated"
      padding="lg"
      className="col-span-12 md:col-span-6 lg:col-span-5 row-span-2 relative overflow-hidden animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        aria-hidden="true"
        className="absolute -top-10 -right-10 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none"
      />
      <div className="relative flex flex-col h-full gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-overline uppercase tracking-wider text-on-surface-variant">
              Mensajes hoy
            </span>
            <span className="text-display-md text-primary">{value}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon name="forum" size="lg" filled />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="success" size="sm">
            <Icon name="trending_up" size="xs" />
            {trend}
          </Badge>
          <span className="text-caption text-on-surface-variant">vs. día anterior</span>
        </div>

        <div className="flex-1 flex flex-col gap-3">
          <span className="text-caption uppercase tracking-wider text-on-surface-variant">
            Últimas 15 horas
          </span>
          <div
            role="img"
            aria-label={`Tráfico por hora (últimas ${hourlyTraffic.length} horas)`}
            className="flex-1 flex items-end gap-1 min-h-[96px]"
          >
            {hourlyTraffic.map((count, index) => {
              const height = Math.max((count / maxTraffic) * 100, 4);
              return (
                <div
                  key={index}
                  role="presentation"
                  className="flex-1 bg-primary/15 hover:bg-primary rounded-t-lg transition-colors duration-250 ease-premium relative group"
                  style={{ height: `${height}%` }}
                >
                  <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-overline px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {count} msg
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}

interface StatTileProps {
  stat: StatDefinition;
  delay: number;
  className?: string;
}

function StatTile({ stat, delay, className }: StatTileProps) {
  return (
    <Card
      variant="glass-elevated"
      interactive
      padding="md"
      className={cn('relative overflow-hidden animate-fade-in-up', className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-20 h-20 bg-primary/5 rounded-bl-full -mr-6 -mt-6"
      />
      <div className="relative flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', TONE_ICON_CLASSES[stat.tone])}>
            <Icon name={stat.icon} size="md" />
          </div>
          <Badge variant={stat.deltaVariant} size="sm">
            {stat.deltaLabel}
          </Badge>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-caption uppercase tracking-wider text-on-surface-variant">
            {stat.title}
          </span>
          <span className="text-display-sm text-primary">{stat.value}</span>
        </div>
      </div>
    </Card>
  );
}

interface TrafficCardProps {
  hourlyTraffic: number[];
  maxTraffic: number;
  total: number;
  delay: number;
}

function TrafficCard({ hourlyTraffic, maxTraffic, total, delay }: TrafficCardProps) {
  return (
    <Card
      variant="glass"
      padding="lg"
      className="col-span-12 lg:col-span-7 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Card.Header>
        <div>
          <h3 className="text-heading-sm text-primary">Tráfico en tiempo real</h3>
          <p className="text-caption text-on-surface-variant">
            Mensajes procesados en las últimas 15 horas
          </p>
        </div>
        <Badge variant="primary" size="md">
          {total} total
        </Badge>
      </Card.Header>
      <Card.Body>
        <div
          role="img"
          aria-label={`Tráfico en tiempo real (últimas ${hourlyTraffic.length} horas, total ${total})`}
          className="h-56 flex items-end gap-1.5"
        >
          {hourlyTraffic.map((count, index) => {
            const height = Math.max((count / maxTraffic) * 100, 4);
            return (
              <div
                key={index}
                role="presentation"
                className="flex-1 bg-primary/10 hover:bg-primary rounded-t-lg transition-colors duration-250 ease-premium relative group"
                style={{ height: `${height}%` }}
              >
                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-inverse-surface text-inverse-on-surface text-overline px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {count} msg
                </span>
              </div>
            );
          })}
        </div>
      </Card.Body>
    </Card>
  );
}

interface ActivityCardProps {
  logs: AuditLog[];
  total: number;
  onOpenAudit: () => void;
  delay: number;
}

function ActivityCard({ logs, total, onOpenAudit, delay }: ActivityCardProps) {
  return (
    <Card
      variant="glass"
      padding="lg"
      className="col-span-12 lg:col-span-5 flex flex-col animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <Card.Header>
        <div>
          <h3 className="text-heading-sm text-primary">Actividad reciente</h3>
          <p className="text-caption text-on-surface-variant">Últimos eventos del sistema</p>
        </div>
        <Badge variant="neutral" size="sm">
          {total}
        </Badge>
      </Card.Header>
      <Card.Body className="flex-1">
        {logs.length === 0 ? (
          <EmptyState
            icon="timeline"
            title="Sin actividad reciente"
            description="Los eventos aparecerán aquí en tiempo real."
          />
        ) : (
          <ul className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {logs.map((log, index) => {
              const isError = log.action.includes('ERROR');
              const isPause = log.action.includes('PAUSE');
              const icon = isError ? 'error' : isPause ? 'pause_circle' : 'bolt';
              const tone: StatTone = isError ? 'warning' : 'success';
              return (
                <li
                  key={`${log.action}-${index}`}
                  className="flex gap-3 animate-fade-in-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div
                    className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
                      TONE_ICON_CLASSES[tone],
                    )}
                  >
                    <Icon name={icon} size="sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-sm font-semibold text-on-surface truncate">
                      {log.action}
                    </p>
                    <p className="text-caption text-on-surface-variant truncate">
                      {typeof log.details === 'string'
                        ? log.details
                        : JSON.stringify(log.details).slice(0, 60)}
                    </p>
                    <span className="text-overline uppercase text-on-surface-variant/70">
                      {new Date(log.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card.Body>
      <Card.Footer>
        <Button
          variant="secondary"
          size="sm"
          fullWidth
          trailingIcon="arrow_forward"
          onClick={onOpenAudit}
        >
          Ver historial de auditoría
        </Button>
      </Card.Footer>
    </Card>
  );
}

interface PlanData {
  plan: {
    name: string;
    maxLines: number;
    maxUsers: number;
    maxConversationsPerMonth: number;
    aiEnabled: boolean;
    price: number;
  } | null;
  org: {
    name: string;
    trialEndsAt: string | null;
    conversationsThisMonth: number;
    planStartedAt: string | null;
    isActive: boolean;
    planId: string | null;
  };
  linesCount: number;
  usersCount: number;
}

const PLAN_UPGRADE_OPTIONS = ['Starter', 'Pro', 'Enterprise'] as const;
type UpgradePlanOption = typeof PLAN_UPGRADE_OPTIONS[number];

function PlanUsageCard() {
  const toast = useToast();
  const [data, setData] = useState<PlanData | null>(null);
  const [loadingState, setLoadingState] = useState<'loading' | 'loaded' | 'forbidden'>('loading');
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [desiredPlan, setDesiredPlan] = useState<UpgradePlanOption>('Starter');
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [submittingUpgrade, setSubmittingUpgrade] = useState(false);

  useEffect(() => {
    apiFetchJson<PlanData>('/api/org/plan')
      .then(d => { setData(d); setLoadingState('loaded'); })
      .catch((err: unknown) => {
        const status = err instanceof Error && err.message.includes('403') ? 'forbidden' : 'loaded';
        setLoadingState(status);
      });
  }, []);

  const submitUpgrade = async () => {
    setSubmittingUpgrade(true);
    try {
      await apiFetchJson('/api/org/plan/request-upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ desiredPlan, notes: upgradeNotes }),
      });
      toast.show('¡Solicitud enviada! Te contactaremos pronto.', { variant: 'success' });
      setShowUpgradeForm(false);
      setUpgradeNotes('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al enviar solicitud';
      toast.show(msg, { variant: 'error' });
    } finally {
      setSubmittingUpgrade(false);
    }
  };

  if (loadingState === 'loading') {
    return <SkeletonCard className="col-span-12 h-auto" />;
  }

  if (loadingState === 'forbidden') {
    return (
      <Card variant="glass" padding="md" className="col-span-12">
        <div className="flex items-center gap-3 text-warning">
          <Icon name="warning" size="sm" />
          <span className="text-body-sm font-medium text-on-surface">
            Trial vencido — contactá al administrador
          </span>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const { plan, org, linesCount, usersCount } = data;
  const planName = plan?.name ?? 'Sin plan';
  const isTrial = !plan || plan.name.toLowerCase().includes('trial');
  const showUpgradeButton = isTrial || !org.planId;
  const conversations = org.conversationsThisMonth;
  const maxConversations = plan?.maxConversationsPerMonth ?? -1;
  const maxLines = plan?.maxLines ?? -1;
  const maxUsers = plan?.maxUsers ?? -1;

  const trialDaysLeft = (() => {
    if (!org.trialEndsAt) return null;
    const ms = new Date(org.trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  })();

  const showTrialWarning = trialDaysLeft !== null && trialDaysLeft <= 7;

  const fmt = (n: number) => (n === -1 ? 'ilimitado' : String(n));
  const fmtBar = (used: number, max: number) => max === -1 ? null : Math.min((used / max) * 100, 100);
  const convProgress = fmtBar(conversations, maxConversations);

  return (
    <Card variant="glass" padding="md" className="col-span-12 space-y-3">
      {showTrialWarning && (
        <div className="flex items-center justify-between gap-3 bg-warning-container text-on-warning-container rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Icon name="schedule" size="sm" />
            <span className="text-body-sm font-medium">
              Tu trial vence en {trialDaysLeft} día{trialDaysLeft === 1 ? '' : 's'}
            </span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowUpgradeForm(true)}
          >
            Solicitar plan
          </Button>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Icon name="workspace_premium" size="sm" />
          </div>
          <div>
            <p className="text-overline uppercase tracking-wider text-on-surface-variant">Uso del plan</p>
            <p className="text-body font-semibold text-on-surface">{planName}</p>
          </div>
        </div>
        {showUpgradeButton && !showUpgradeForm && (
          <Button variant="secondary" size="sm" onClick={() => setShowUpgradeForm(true)}>
            {isTrial ? 'Solicitar upgrade' : 'Cambiar plan'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="space-y-1">
          <p className="text-caption text-on-surface-variant">Conversaciones/mes</p>
          <p className="text-body-sm font-semibold text-on-surface">
            {conversations} / {fmt(maxConversations)}
          </p>
          {convProgress !== null && (
            <div className="h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', convProgress >= 90 ? 'bg-error' : convProgress >= 70 ? 'bg-warning' : 'bg-primary')}
                style={{ width: `${convProgress}%` }}
              />
            </div>
          )}
        </div>
        <div>
          <p className="text-caption text-on-surface-variant">Líneas</p>
          <p className="text-body-sm font-semibold text-on-surface">{linesCount} / {fmt(maxLines)}</p>
        </div>
        <div>
          <p className="text-caption text-on-surface-variant">Usuarios</p>
          <p className="text-body-sm font-semibold text-on-surface">{usersCount} / {fmt(maxUsers)}</p>
        </div>
      </div>

      {showUpgradeForm && (
        <div className="border-t border-outline-variant/40 pt-3 space-y-3">
          <p className="text-body-sm font-semibold text-on-surface">Solicitar upgrade de plan</p>
          <div>
            <label className="text-caption text-on-surface-variant block mb-1">Plan deseado</label>
            <select
              value={desiredPlan}
              onChange={e => setDesiredPlan(e.target.value as UpgradePlanOption)}
              className="w-full border border-outline-variant/60 rounded-xl px-3 py-2 text-body text-on-surface bg-white/70 focus:ring-2 focus:ring-primary/30 outline-none text-sm"
            >
              {PLAN_UPGRADE_OPTIONS.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-caption text-on-surface-variant block mb-1">Notas adicionales (opcional)</label>
            <textarea
              value={upgradeNotes}
              onChange={e => setUpgradeNotes(e.target.value)}
              rows={2}
              placeholder="¿Algo que quieras contarnos sobre tu caso de uso?"
              className="w-full border border-outline-variant/60 rounded-xl px-3 py-2 text-body text-on-surface bg-white/70 focus:ring-2 focus:ring-primary/30 outline-none resize-none text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={submitUpgrade} loading={submittingUpgrade}>
              Enviar solicitud
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowUpgradeForm(false); setUpgradeNotes(''); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

export default Dashboard;
