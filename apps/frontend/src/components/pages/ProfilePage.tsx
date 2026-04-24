import { useState } from 'react';
import { Button, Card, FormInput, Icon } from '../ui';

interface ProfileUser {
  name?: string;
  email?: string;
  role?: string;
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
      {/* User info */}
      <Card variant="glass" padding="lg">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-on-primary text-heading-sm font-bold uppercase shadow-glass">
            {(user?.name || 'A').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h2 className="text-heading-sm text-on-surface font-semibold">
              {user?.name || '—'}
            </h2>
            <p className="text-body-sm text-on-surface-variant">{user?.email || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-surface-container-low rounded-xl">
            <p className="text-overline text-on-surface-variant uppercase mb-1">Nombre</p>
            <p className="text-body font-medium text-on-surface">{user?.name || '—'}</p>
          </div>
          <div className="p-3 bg-surface-container-low rounded-xl">
            <p className="text-overline text-on-surface-variant uppercase mb-1">Rol</p>
            <p className="text-body font-medium text-on-surface uppercase">{user?.role || '—'}</p>
          </div>
          <div className="col-span-2 p-3 bg-surface-container-low rounded-xl">
            <p className="text-overline text-on-surface-variant uppercase mb-1">Email</p>
            <p className="text-body font-medium text-on-surface">{user?.email || '—'}</p>
          </div>
        </div>
      </Card>

      {/* Change password */}
      <Card variant="glass" padding="lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon name="lock" size="md" className="text-primary" />
          </div>
          <h3 className="text-heading-sm text-on-surface font-semibold">Cambiar contraseña</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
          {errorMsg && (
            <div
              role="alert"
              className="p-3 bg-error-container border border-error/20 rounded-xl text-body-sm text-on-error-container flex items-center gap-2"
            >
              <Icon name="error" size="sm" />
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div
              role="status"
              className="p-3 bg-success-container border border-success/20 rounded-xl text-body-sm text-on-success-container flex items-center gap-2"
            >
              <Icon name="check_circle" size="sm" />
              <span>{successMsg}</span>
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
