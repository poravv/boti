import { useState } from 'react';
import { Badge, Button, Card, FormInput, Icon } from '../ui';

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
      <div className="mb-6">
        <h1 className="text-heading-lg font-bold text-on-surface">Mi perfil</h1>
        <p className="text-on-surface-variant text-body mt-1">Gestiona tu información y acceso</p>
      </div>

      {/* User info */}
      <Card variant="glass" className="p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-on-primary text-heading-md font-bold uppercase shadow-glass flex-shrink-0">
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

      {/* Change password */}
      <Card variant="glass" className="p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-outline-variant/30">
          <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center">
            <Icon name="lock" size="sm" className="text-primary" />
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
