import { useEffect, useState } from 'react';
import { Badge, Button, Card, FormInput, Icon } from '../ui';
import { SOUND_PREF_KEY } from '../../App';
import { apiFetchJson } from '../../lib/apiClient';

interface ProfileUser {
  name?: string;
  email?: string;
  role?: string;
  orgId?: string;
}

interface OrgData {
  id: string;
  name: string;
  slug: string;
  description: string;
  isActive: boolean;
  trialEndsAt: string | null;
  plan: { name: string; slug: string } | null;
}

interface ProfilePageProps {
  user: ProfileUser;
}

export function ProfilePage({ user }: ProfilePageProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(
    () => localStorage.getItem(SOUND_PREF_KEY) !== 'false',
  );

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const [org, setOrg] = useState<OrgData | null>(null);
  const [orgEditing, setOrgEditing] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgError, setOrgError] = useState('');
  const [orgSuccess, setOrgSuccess] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    apiFetchJson<OrgData>('/api/org')
      .then((data) => {
        setOrg(data);
        setOrgName(data.name);
        setOrgDescription(data.description);
      })
      .catch(() => {});
  }, [isAdmin]);

  const handleOrgSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setOrgError('');
    setOrgSuccess('');
    if (!orgName.trim()) { setOrgError('El nombre es requerido.'); return; }
    setOrgSaving(true);
    try {
      const updated = await apiFetchJson<OrgData>('/api/org', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, description: orgDescription }),
      });
      setOrg(updated);
      setOrgEditing(false);
      setOrgSuccess('Organización actualizada.');
    } catch (err: any) {
      setOrgError(err.message || 'Error al guardar.');
    } finally {
      setOrgSaving(false);
    }
  };

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem(SOUND_PREF_KEY, String(next));
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas nuevas no coinciden.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMsg('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/auth/change-password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Error al cambiar contraseña.');
      } else {
        setSuccessMsg('Contraseña actualizada correctamente.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setErrorMsg('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 py-2">
      <div className="mb-6">
        <h1 className="text-heading-lg font-bold text-on-surface">Mi perfil</h1>
        <p className="text-on-surface-variant text-body mt-1">Gestiona tu información y acceso</p>
      </div>

      {/* User info */}
      <Card variant="glass" className="p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-action flex items-center justify-center text-white text-heading-md font-bold uppercase shadow-glass flex-shrink-0">
            {user?.name?.[0] ?? 'A'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-heading-sm font-bold text-on-surface">{user?.name || '—'}</h2>
            <p className="text-on-surface-variant text-body mt-0.5">{user?.email || '—'}</p>
            <div className="mt-3">
              <Badge variant={user?.role === 'ADMIN' ? 'primary' : 'secondary'}>
                {user?.role === 'ADMIN' ? 'Administrador' : 'Operador'}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Preferences */}
      <Card variant="glass" className="p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-outline-variant/30">
          <div className="w-9 h-9 rounded-xl bg-action/8 flex items-center justify-center">
            <Icon name="tune" size="sm" className="text-action" />
          </div>
          <div>
            <h3 className="text-heading-sm font-semibold text-on-surface">Preferencias</h3>
            <p className="text-on-surface-variant text-body-sm">Ajustes locales de la aplicación</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon
              name={soundEnabled ? 'volume_up' : 'volume_off'}
              size="sm"
              className={soundEnabled ? 'text-action' : 'text-on-surface-variant'}
            />
            <div>
              <p className="text-body font-medium text-on-surface">Sonido de notificaciones</p>
              <p className="text-body-sm text-on-surface-variant">
                {soundEnabled ? 'Activo — suena al recibir mensajes' : 'Silenciado'}
              </p>
            </div>
          </div>
          <button
            onClick={toggleSound}
            role="switch"
            aria-checked={soundEnabled}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              soundEnabled ? 'bg-action text-white' : 'bg-outline-variant'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${
                soundEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </Card>

      {/* Organization — ADMIN only */}
      {isAdmin && org && (
        <Card variant="glass" className="p-6">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-outline-variant/30">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-action/8 flex items-center justify-center">
                <Icon name="business" size="sm" className="text-action" />
              </div>
              <div>
                <h3 className="text-heading-sm font-semibold text-on-surface">Mi organización</h3>
                <p className="text-on-surface-variant text-body-sm">Datos visibles de tu empresa o equipo</p>
              </div>
            </div>
            {!orgEditing && (
              <Button variant="ghost" size="sm" onClick={() => { setOrgEditing(true); setOrgSuccess(''); setOrgError(''); }}>
                <Icon name="edit" size="sm" />
              </Button>
            )}
          </div>

          {orgSuccess && !orgEditing && (
            <div role="status" className="bg-success-container text-on-success-container rounded-xl px-4 py-3 flex items-center gap-2 mb-4">
              <Icon name="check_circle" size="sm" />
              <span className="text-body-sm">{orgSuccess}</span>
            </div>
          )}

          {orgEditing ? (
            <form onSubmit={handleOrgSave} className="space-y-4" noValidate>
              {orgError && (
                <div role="alert" className="bg-error-container text-on-error-container rounded-xl px-4 py-3 flex items-center gap-2">
                  <Icon name="error" size="sm" />
                  <span className="text-body-sm">{orgError}</span>
                </div>
              )}
              <FormInput
                label="Nombre de la organización"
                floatingLabel
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                required
              />
              <FormInput
                label="Descripción (opcional)"
                floatingLabel
                value={orgDescription}
                onChange={(e) => setOrgDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <Button type="submit" variant="primary" size="md" loading={orgSaving} disabled={orgSaving}>
                  Guardar
                </Button>
                <Button type="button" variant="ghost" size="md" onClick={() => { setOrgEditing(false); setOrgName(org.name); setOrgDescription(org.description); }}>
                  Cancelar
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-body-sm text-on-surface-variant w-28 shrink-0">Nombre</span>
                <span className="text-body font-medium text-on-surface">{org.name}</span>
              </div>
              {org.description && (
                <div className="flex items-start gap-3">
                  <span className="text-body-sm text-on-surface-variant w-28 shrink-0">Descripción</span>
                  <span className="text-body text-on-surface">{org.description}</span>
                </div>
              )}
              <div className="flex items-start gap-3">
                <span className="text-body-sm text-on-surface-variant w-28 shrink-0">Slug</span>
                <span className="text-body-sm text-on-surface-variant font-mono">{org.slug}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-body-sm text-on-surface-variant w-28 shrink-0">Plan</span>
                <span className="text-body text-on-surface">{org.plan?.name ?? '—'}</span>
              </div>
              {org.trialEndsAt && (
                <div className="flex items-start gap-3">
                  <span className="text-body-sm text-on-surface-variant w-28 shrink-0">Trial hasta</span>
                  <span className="text-body text-on-surface">
                    {new Date(org.trialEndsAt).toLocaleDateString('es-PY', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Change password */}
      <Card variant="glass" className="p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-outline-variant/30">
          <div className="w-9 h-9 rounded-xl bg-action/8 flex items-center justify-center">
            <Icon name="lock" size="sm" className="text-action" />
          </div>
          <div>
            <h3 className="text-heading-sm font-semibold text-on-surface">Cambiar contraseña</h3>
            <p className="text-on-surface-variant text-body-sm">Actualiza tu contraseña de acceso</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
          {errorMsg && (
            <div
              role="alert"
              className="bg-error-container text-on-error-container rounded-xl px-4 py-3 flex items-center gap-2"
            >
              <Icon name="error" size="sm" />
              <span className="text-body-sm">{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div
              role="status"
              className="bg-success-container text-on-success-container rounded-xl px-4 py-3 flex items-center gap-2"
            >
              <Icon name="check_circle" size="sm" />
              <span className="text-body-sm">{successMsg}</span>
            </div>
          )}

          <FormInput
            label="Contraseña actual"
            floatingLabel
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <FormInput
            label="Nueva contraseña"
            floatingLabel
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <FormInput
            label="Confirmar nueva contraseña"
            floatingLabel
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            Actualizar contraseña
          </Button>
        </form>
      </Card>
    </div>
  );
}
