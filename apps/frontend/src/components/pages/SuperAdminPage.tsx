import { useEffect, useState, useCallback } from 'react';
import { Button, Icon, Badge, useToast, Modal, FormInput } from '../ui';
import { apiFetch, apiFetchJson } from '../../lib/apiClient';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  maxLines: number;
  maxUsers: number;
  maxConversationsPerMonth: number;
  trialDays: number;
  aiEnabled: boolean;
  isActive: boolean;
  _count?: { organizations: number };
}

interface Org {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  trialEndsAt: string | null;
  trialExpired: boolean;
  planStartedAt: string | null;
  conversationsThisMonth: number;
  lineCount: number;
  userCount: number;
  plan: Plan | null;
  owner: { email: string; name: string } | null;
}

interface GlobalStats {
  totalOrgs: number;
  activeOrgs: number;
  trialOrgs: number;
  totalUsers: number;
  totalLines: number;
  plans: Plan[];
}

interface SuperAdmin {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

type Tab = 'overview' | 'orgs' | 'plans' | 'admins' | 'config';

const MASKED_PASSWORD = '••••••••';

interface SmtpConfig {
  smtp_host: string;
  smtp_port: string;
  smtp_secure: string;
  smtp_user: string;
  smtp_pass: string;
  smtp_from_name: string;
  smtp_from_email: string;
}

const SMTP_DEFAULTS: SmtpConfig = {
  smtp_host: '',
  smtp_port: '587',
  smtp_secure: 'false',
  smtp_user: '',
  smtp_pass: '',
  smtp_from_name: '',
  smtp_from_email: '',
};

const UNLIMITED = -1;
const fmt = (n: number) => (n === UNLIMITED ? '∞' : n.toString());

const planColor: Record<string, string> = {
  trial: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  starter: 'bg-blue-100 text-blue-800 border-blue-200',
  pro: 'bg-purple-100 text-purple-800 border-purple-200',
  enterprise: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

export function SuperAdminPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editOrg, setEditOrg] = useState<Org | null>(null);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', slug: '', price: '0', maxLines: '1', maxUsers: '5', maxConversationsPerMonth: '1000', trialDays: '0', aiEnabled: true });
  const [orgPatch, setOrgPatch] = useState<{ planId: string; isActive: boolean; trialEndsAt: string }>({ planId: '', isActive: true, trialEndsAt: '' });
  const [superAdmins, setSuperAdmins] = useState<SuperAdmin[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [smtpConfig, setSmtpConfig] = useState<SmtpConfig>(SMTP_DEFAULTS);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [showTestEmailForm, setShowTestEmailForm] = useState(false);
  const [testEmailAddress, setTestEmailAddress] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, o, p, a] = await Promise.all([
        apiFetchJson<GlobalStats>('/api/admin/stats'),
        apiFetchJson<{ orgs: Org[] }>('/api/admin/orgs'),
        apiFetchJson<{ plans: Plan[] }>('/api/admin/plans'),
        apiFetchJson<{ admins: SuperAdmin[] }>('/api/admin/superadmins'),
      ]);
      setStats(s);
      setOrgs(o.orgs);
      setPlans(p.plans);
      setSuperAdmins(a.admins);
    } catch (err: any) {
      toast.show(err.message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEditOrg = (org: Org) => {
    setEditOrg(org);
    setOrgPatch({
      planId: org.plan?.id ?? '',
      isActive: org.isActive,
      trialEndsAt: org.trialEndsAt ? org.trialEndsAt.slice(0, 10) : '',
    });
  };

  const saveOrg = async () => {
    if (!editOrg) return;
    try {
      await apiFetchJson(`/api/admin/orgs/${editOrg.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: orgPatch.planId || undefined,
          isActive: orgPatch.isActive,
          trialEndsAt: orgPatch.trialEndsAt || undefined,
        }),
      });
      toast.show('Organización actualizada.', { variant: 'success' });
      setEditOrg(null);
      load();
    } catch (err: any) {
      toast.show(err.message, { variant: 'error' });
    }
  };

  const savePlan = async () => {
    if (!editPlan) return;
    try {
      await apiFetchJson(`/api/admin/plans/${editPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPlan),
      });
      toast.show('Plan actualizado.', { variant: 'success' });
      setEditPlan(null);
      load();
    } catch (err: any) {
      toast.show(err.message, { variant: 'error' });
    }
  };

  const createPlan = async () => {
    try {
      await apiFetchJson('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPlan),
      });
      toast.show('Plan creado.', { variant: 'success' });
      setShowNewPlan(false);
      setNewPlan({ name: '', slug: '', price: '0', maxLines: '1', maxUsers: '5', maxConversationsPerMonth: '1000', trialDays: '0', aiEnabled: true });
      load();
    } catch (err: any) {
      toast.show(err.message, { variant: 'error' });
    }
  };

  const promoteAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    setAddingAdmin(true);
    try {
      await apiFetchJson('/api/admin/superadmins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail.trim() }),
      });
      toast.show('Super admin agregado.', { variant: 'success' });
      setNewAdminEmail('');
      load();
    } catch (err: any) {
      toast.show(err.message, { variant: 'error' });
    } finally {
      setAddingAdmin(false);
    }
  };

  const revokeAdmin = async (id: string) => {
    try {
      await apiFetchJson(`/api/admin/superadmins/${id}`, { method: 'DELETE' });
      toast.show('Rol de super admin revocado.', { variant: 'success' });
      load();
    } catch (err: any) {
      toast.show(err.message, { variant: 'error' });
    }
  };

  const loadSmtpConfig = useCallback(async () => {
    setSmtpLoading(true);
    try {
      const data = await apiFetchJson<{ config: { key: string; value: string }[] }>('/api/admin/config');
      const map: Partial<SmtpConfig> = {};
      for (const entry of data.config) {
        if (entry.key in SMTP_DEFAULTS) {
          (map as Record<string, string>)[entry.key] = entry.value;
        }
      }
      setSmtpConfig({ ...SMTP_DEFAULTS, ...map });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar configuración';
      toast.show(msg, { variant: 'error' });
    } finally {
      setSmtpLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'config') loadSmtpConfig();
  }, [tab, loadSmtpConfig]);

  const saveSmtpConfig = async () => {
    setSmtpSaving(true);
    try {
      const entries = Object.entries(smtpConfig) as [string, string][];
      const payload = entries
        .filter(([, value]) => value !== MASKED_PASSWORD)
        .map(([key, value]) => ({ key, value }));
      await apiFetch('/api/admin/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      toast.show('Configuración guardada.', { variant: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      toast.show(msg, { variant: 'error' });
    } finally {
      setSmtpSaving(false);
    }
  };

  const filteredOrgs = orgs.filter(o =>
    o.name.toLowerCase().includes(search.toLowerCase()) ||
    o.owner?.email.toLowerCase().includes(search.toLowerCase())
  );

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Resumen', icon: 'dashboard' },
    { id: 'orgs', label: 'Organizaciones', icon: 'business' },
    { id: 'plans', label: 'Planes', icon: 'workspace_premium' },
    { id: 'admins', label: 'Super Admins', icon: 'shield_person' },
    { id: 'config', label: 'Configuración', icon: 'settings' },
  ];

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon name="admin_panel_settings" size="md" className="text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Super Admin</h1>
          <p className="text-sm text-muted-foreground">Control total del sistema</p>
        </div>
        <Button variant="secondary" size="sm" className="ml-auto" onClick={load}>
          <Icon name="refresh" size="sm" />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
              ${tab === t.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Icon name={t.icon} size="sm" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Organizaciones', value: stats.totalOrgs, icon: 'business', color: 'text-blue-600' },
              { label: 'Activas', value: stats.activeOrgs, icon: 'check_circle', color: 'text-emerald-600' },
              { label: 'En Trial', value: stats.trialOrgs, icon: 'schedule', color: 'text-yellow-600' },
              { label: 'Usuarios totales', value: stats.totalUsers, icon: 'group', color: 'text-purple-600' },
            ].map(s => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground text-xs">{s.label}</div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-bold text-foreground">{s.value}</span>
                  <Icon name={s.icon} size="sm" className={s.color} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Icon name="workspace_premium" size="sm" className="text-primary" />
              Distribución por plan
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {stats.plans.map(p => (
                <div key={p.id} className={`rounded-lg border px-4 py-3 ${planColor[p.slug] ?? 'bg-muted text-foreground border-border'}`}>
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-2xl font-bold">{p._count?.organizations ?? 0}</div>
                  <div className="text-xs opacity-70">{p.price === 0 ? 'Gratis' : `$${p.price}/mes`}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ORGANIZACIONES ── */}
      {tab === 'orgs' && (
        <div className="space-y-4">
          <FormInput
            label=""
            placeholder="Buscar por nombre u owner..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {['Organización', 'Owner', 'Plan', 'Estado', 'Líneas', 'Usuarios', 'Trial vence', 'Acciones'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map(org => (
                  <tr key={org.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{org.name}</div>
                      <div className="text-xs text-muted-foreground">{org.slug}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-foreground">{org.owner?.name ?? '—'}</div>
                      <div className="text-xs text-muted-foreground">{org.owner?.email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      {org.plan ? (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${planColor[org.plan.slug] ?? 'bg-muted'}`}>
                          {org.plan.name}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">Sin plan</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={org.isActive ? 'success' : 'danger'} size="sm">
                        {org.isActive ? 'Activa' : 'Inactiva'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center text-foreground">{org.lineCount}</td>
                    <td className="px-4 py-3 text-center text-foreground">{org.userCount}</td>
                    <td className="px-4 py-3">
                      {org.trialEndsAt ? (
                        <span className={`text-xs ${org.trialExpired ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                          {org.trialExpired ? '⚠ ' : ''}{new Date(org.trialEndsAt).toLocaleDateString()}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Button variant="secondary" size="sm" onClick={() => openEditOrg(org)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredOrgs.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-sm">Sin resultados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PLANES ── */}
      {tab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={() => setShowNewPlan(true)}>
              <Icon name="add" size="sm" /> Nuevo plan
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(plan => (
              <div key={plan.id} className={`rounded-xl border-2 p-5 space-y-3 ${planColor[plan.slug] ?? 'border-border'}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  {!plan.isActive && <Badge variant="warning" size="sm">Inactivo</Badge>}
                </div>
                <div className="text-3xl font-bold">{plan.price === 0 ? 'Gratis' : `$${plan.price}`}
                  {plan.price > 0 && <span className="text-sm font-normal opacity-60">/mes</span>}
                </div>
                {plan.trialDays > 0 && <div className="text-xs opacity-70">Trial: {plan.trialDays} días</div>}
                <ul className="space-y-1.5 text-sm">
                  <li className="flex gap-2 items-center"><Icon name="link" size="sm" />{fmt(plan.maxLines)} línea{plan.maxLines !== 1 ? 's' : ''}</li>
                  <li className="flex gap-2 items-center"><Icon name="group" size="sm" />{fmt(plan.maxUsers)} usuario{plan.maxUsers !== 1 ? 's' : ''}</li>
                  <li className="flex gap-2 items-center"><Icon name="forum" size="sm" />{fmt(plan.maxConversationsPerMonth)} conv/mes</li>
                  <li className="flex gap-2 items-center"><Icon name="psychology" size="sm" />{plan.aiEnabled ? 'IA incluida' : 'Sin IA'}</li>
                </ul>
                <Button variant="secondary" size="sm" className="w-full" onClick={() => setEditPlan({ ...plan })}>
                  Editar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SUPER ADMINS TAB ── */}
      {tab === 'admins' && (
        <div className="space-y-6">
          {/* Add new super admin */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
              <Icon name="shield_person" size="sm" className="text-primary" />
              Agregar super admin
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              El usuario debe estar registrado en el sistema. Se le asignará rol SUPERADMIN.
            </p>
            <div className="flex gap-3">
              <FormInput
                type="email"
                placeholder="email@ejemplo.com"
                value={newAdminEmail}
                onChange={e => setNewAdminEmail(e.target.value)}
                containerClassName="flex-1"
                onKeyDown={e => e.key === 'Enter' && promoteAdmin()}
              />
              <Button variant="primary" size="md" onClick={promoteAdmin} loading={addingAdmin} disabled={!newAdminEmail.trim()}>
                Agregar
              </Button>
            </div>
          </div>

          {/* Current super admins list */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-muted/40">
              <h3 className="font-semibold text-foreground text-sm">Super admins activos ({superAdmins.length})</h3>
            </div>
            {superAdmins.length === 0 ? (
              <div className="px-5 py-8 text-center text-muted-foreground text-sm">Sin super admins registrados</div>
            ) : (
              <ul className="divide-y divide-border">
                {superAdmins.map(admin => (
                  <li key={admin.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                    <div>
                      <div className="font-medium text-foreground text-sm">{admin.name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{admin.email}</div>
                      <div className="text-xs text-muted-foreground">
                        Desde {new Date(admin.createdAt).toLocaleDateString('es-PY')}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeAdmin(admin.id)}
                      className="text-error hover:bg-error/10"
                    >
                      <Icon name="remove_moderator" size="sm" />
                      Revocar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ── CONFIGURACIÓN ── */}
      {tab === 'config' && (
        <div className="space-y-6 max-w-2xl">
          <div className="bg-card border border-border rounded-xl p-5 space-y-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Icon name="mail" size="sm" className="text-primary" />
              Servidor de correo (SMTP)
            </h3>

            {smtpLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="Servidor SMTP"
                    placeholder="smtp.gmail.com"
                    value={smtpConfig.smtp_host}
                    onChange={e => setSmtpConfig(c => ({ ...c, smtp_host: e.target.value }))}
                  />
                  <FormInput
                    label="Puerto"
                    type="number"
                    placeholder="587"
                    value={smtpConfig.smtp_port}
                    onChange={e => setSmtpConfig(c => ({ ...c, smtp_port: e.target.value }))}
                  />
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-foreground">SSL/TLS</label>
                  <button
                    type="button"
                    onClick={() => setSmtpConfig(c => ({ ...c, smtp_secure: c.smtp_secure === 'true' ? 'false' : 'true' }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${smtpConfig.smtp_secure === 'true' ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                    aria-checked={smtpConfig.smtp_secure === 'true'}
                    role="switch"
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow ${smtpConfig.smtp_secure === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                  <span className="text-sm text-muted-foreground">
                    {smtpConfig.smtp_secure === 'true' ? 'Activado' : 'Desactivado'}
                  </span>
                </div>

                <FormInput
                  label="Usuario / Email"
                  type="email"
                  placeholder="tu@gmail.com"
                  value={smtpConfig.smtp_user}
                  onChange={e => setSmtpConfig(c => ({ ...c, smtp_user: e.target.value }))}
                />

                <FormInput
                  label="Contraseña"
                  type="password"
                  placeholder="••••••••"
                  value={smtpConfig.smtp_pass}
                  onChange={e => setSmtpConfig(c => ({ ...c, smtp_pass: e.target.value }))}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormInput
                    label="Nombre del remitente"
                    placeholder="Boti Notificaciones"
                    value={smtpConfig.smtp_from_name}
                    onChange={e => setSmtpConfig(c => ({ ...c, smtp_from_name: e.target.value }))}
                  />
                  <FormInput
                    label="Email del remitente"
                    type="email"
                    placeholder="noreply@tudominio.com"
                    value={smtpConfig.smtp_from_email}
                    onChange={e => setSmtpConfig(c => ({ ...c, smtp_from_email: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <Button variant="primary" size="md" onClick={saveSmtpConfig} loading={smtpSaving}>
                    Guardar configuración
                  </Button>

                  {showTestEmailForm ? (
                    <div className="flex gap-3">
                      <FormInput
                        label=""
                        type="email"
                        placeholder="test@ejemplo.com"
                        value={testEmailAddress}
                        onChange={e => setTestEmailAddress(e.target.value)}
                        containerClassName="flex-1"
                      />
                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => {
                          toast.show('Guardá la config primero para probar', { variant: 'warning' });
                          setShowTestEmailForm(false);
                          setTestEmailAddress('');
                        }}
                      >
                        Enviar
                      </Button>
                      <Button variant="ghost" size="md" onClick={() => { setShowTestEmailForm(false); setTestEmailAddress(''); }}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <Button variant="secondary" size="md" onClick={() => setShowTestEmailForm(true)}>
                      Enviar email de prueba
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: editar organización */}
      <Modal open={!!editOrg} onClose={() => setEditOrg(null)} title={`Editar: ${editOrg?.name}`} size="md">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Plan</label>
            <select
              value={orgPatch.planId}
              onChange={e => setOrgPatch(p => ({ ...p, planId: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/30 outline-none"
            >
              <option value="">Sin plan</option>
              {plans.map(p => <option key={p.id} value={p.id}>{p.name} — ${p.price}/mes</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Trial vence</label>
            <input
              type="date"
              value={orgPatch.trialEndsAt}
              onChange={e => setOrgPatch(p => ({ ...p, trialEndsAt: e.target.value }))}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">Activa</label>
            <button
              onClick={() => setOrgPatch(p => ({ ...p, isActive: !p.isActive }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${orgPatch.isActive ? 'bg-primary text-white' : 'bg-muted-foreground/30'}`}
            >
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow ${orgPatch.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditOrg(null)}>Cancelar</Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={saveOrg}>Guardar</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: editar plan */}
      <Modal open={!!editPlan} onClose={() => setEditPlan(null)} title={`Editar plan: ${editPlan?.name}`} size="md">
        {editPlan && (
          <div className="space-y-3">
            <FormInput label="Nombre" value={editPlan.name} onChange={e => setEditPlan(p => p ? { ...p, name: e.target.value } : p)} />
            <FormInput label="Precio (USD/mes)" type="number" value={String(editPlan.price)} onChange={e => setEditPlan(p => p ? { ...p, price: Number(e.target.value) } : p)} />
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Máx. líneas (-1=∞)" type="number" value={String(editPlan.maxLines)} onChange={e => setEditPlan(p => p ? { ...p, maxLines: Number(e.target.value) } : p)} />
              <FormInput label="Máx. usuarios (-1=∞)" type="number" value={String(editPlan.maxUsers)} onChange={e => setEditPlan(p => p ? { ...p, maxUsers: Number(e.target.value) } : p)} />
            </div>
            <FormInput label="Conv/mes (-1=∞)" type="number" value={String(editPlan.maxConversationsPerMonth)} onChange={e => setEditPlan(p => p ? { ...p, maxConversationsPerMonth: Number(e.target.value) } : p)} />
            <FormInput label="Días de trial" type="number" value={String(editPlan.trialDays)} onChange={e => setEditPlan(p => p ? { ...p, trialDays: Number(e.target.value) } : p)} />
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-foreground">IA habilitada</label>
              <button onClick={() => setEditPlan(p => p ? { ...p, aiEnabled: !p.aiEnabled } : p)} className={`relative w-11 h-6 rounded-full transition-colors ${editPlan.aiEnabled ? 'bg-primary text-white' : 'bg-muted-foreground/30'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow ${editPlan.aiEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={() => setEditPlan(null)}>Cancelar</Button>
              <Button variant="primary" size="sm" className="flex-1" onClick={savePlan}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: nuevo plan */}
      <Modal open={showNewPlan} onClose={() => setShowNewPlan(false)} title="Crear nuevo plan" size="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Nombre" value={newPlan.name} onChange={e => setNewPlan(p => ({ ...p, name: e.target.value }))} />
            <FormInput label="Slug (único)" value={newPlan.slug} onChange={e => setNewPlan(p => ({ ...p, slug: e.target.value }))} />
          </div>
          <FormInput label="Precio USD/mes" type="number" value={newPlan.price} onChange={e => setNewPlan(p => ({ ...p, price: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <FormInput label="Máx. líneas (-1=∞)" type="number" value={newPlan.maxLines} onChange={e => setNewPlan(p => ({ ...p, maxLines: e.target.value }))} />
            <FormInput label="Máx. usuarios (-1=∞)" type="number" value={newPlan.maxUsers} onChange={e => setNewPlan(p => ({ ...p, maxUsers: e.target.value }))} />
          </div>
          <FormInput label="Conv/mes (-1=∞)" type="number" value={newPlan.maxConversationsPerMonth} onChange={e => setNewPlan(p => ({ ...p, maxConversationsPerMonth: e.target.value }))} />
          <FormInput label="Días de trial" type="number" value={newPlan.trialDays} onChange={e => setNewPlan(p => ({ ...p, trialDays: e.target.value }))} />
          <div className="flex gap-2 pt-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => setShowNewPlan(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" className="flex-1" onClick={createPlan}>Crear</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
