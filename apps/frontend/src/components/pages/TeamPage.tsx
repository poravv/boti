import { useEffect, useState } from 'react';
import { Badge, Button, Card, FormInput, FormSelect, Icon, Modal } from '../ui';
import { apiFetchJson } from '../../lib/apiClient';

interface Line { id: string; name: string; }

interface TeamUser {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  role: string;
  isActive: boolean;
  lineId: string | null;
  line: Line | null;
}

interface TeamPageProps {
  currentUserId?: string;
}

interface UserFormData {
  name: string;
  username: string;
  password: string;
  role: string;
  lineId: string;
}

const EMPTY_FORM: UserFormData = { name: '', username: '', password: '', role: 'OPERATOR', lineId: '' };

export function TeamPage({ currentUserId }: TeamPageProps) {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState<UserFormData>(EMPTY_FORM);
  const [createError, setCreateError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [editingUser, setEditingUser] = useState<TeamUser | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; role: string; isActive: boolean; lineId: string }>({
    name: '',
    role: '',
    isActive: true,
    lineId: '',
  });
  const [editError, setEditError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadUsers = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const [userData, lineData] = await Promise.all([
        apiFetchJson<{ users: TeamUser[] }>('/api/users'),
        apiFetchJson<{ lines: { id: string; name: string }[] }>('/api/lines').catch(() => ({ lines: [] })),
      ]);
      setUsers(userData.users);
      setLines(lineData.lines);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar usuarios.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!createForm.name.trim() || !createForm.username.trim() || !createForm.password) {
      setCreateError('Todos los campos son requeridos.');
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(createForm.username)) {
      setCreateError('username solo puede contener letras, números, puntos, guiones y guiones bajos.');
      return;
    }
    setIsCreating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Error al crear usuario.');
        return;
      }
      setUsers((prev) => [...prev, data.user]);
      setShowCreateModal(false);
      setCreateForm(EMPTY_FORM);
    } catch {
      setCreateError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsCreating(false);
    }
  };

  const openEdit = (user: TeamUser) => {
    setEditingUser(user);
    setEditForm({ name: user.name, role: user.role, isActive: user.isActive, lineId: user.lineId ?? '' });
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');
    setIsSaving(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'Error al actualizar usuario.');
        return;
      }
      setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data.user : u)));
      setEditingUser(null);
    } catch {
      setEditError('Error de conexión. Intenta de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async (user: TeamUser) => {
    if (user.id === currentUserId) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/users/${user.id}/deactivate`, {
        method: 'PATCH',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) return;
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: false } : u)));
    } catch {
      // Non-fatal
    }
  };

  const handleDelete = async (user: TeamUser) => {
    if (user.id === currentUserId) return;
    if (!confirm(`¿Eliminar permanentemente a ${user.name}? Esta acción no se puede deshacer.`)) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) return;
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch {
      // Non-fatal
    }
  };

  const isSelf = (userId: string) => userId === currentUserId;

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-heading-lg font-bold text-on-surface">Gestión de equipo</h1>
          <p className="text-on-surface-variant text-body mt-1">
            Administra los usuarios y roles del sistema
          </p>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={() => {
            setCreateForm(EMPTY_FORM);
            setCreateError('');
            setShowCreateModal(true);
          }}
          leadingIcon="person_add"
        >
          Agregar operador
        </Button>
      </div>

      {/* Table */}
      <Card variant="glass" className="overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
        ) : errorMsg ? (
          <div className="flex items-center gap-2 p-6 text-error">
            <Icon name="error" size="sm" />
            <span className="text-body-sm">{errorMsg}</span>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
            <Icon name="group" size="lg" />
            <p className="mt-3 text-body">No hay usuarios registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" role="table">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="text-left px-6 py-3 text-caption text-on-surface-variant font-semibold">
                    Operador
                  </th>
                  <th className="text-left px-4 py-3 text-caption text-on-surface-variant font-semibold">
                    Línea asignada
                  </th>
                  <th className="text-left px-4 py-3 text-caption text-on-surface-variant font-semibold">
                    Rol
                  </th>
                  <th className="text-left px-4 py-3 text-caption text-on-surface-variant font-semibold">
                    Estado
                  </th>
                  <th className="px-4 py-3" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container-high/30 transition-colors"
                  >
                    {/* Avatar + name + username */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-body uppercase flex-shrink-0">
                          {user.name[0] ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-body font-semibold text-on-surface truncate">
                            {user.name}
                            {isSelf(user.id) && (
                              <span className="ml-1.5 text-caption text-on-surface-variant font-normal">
                                (tú)
                              </span>
                            )}
                          </p>
                          <p className="text-body-sm text-on-surface-variant truncate">
                            {user.username ? `@${user.username}` : user.email ?? ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    {/* Line */}
                    <td className="px-4 py-4">
                      {user.line ? (
                        <div className="flex items-center gap-1.5">
                          <Icon name="smartphone" size="xs" className="text-primary" />
                          <span className="text-body-sm text-on-surface truncate max-w-[140px]">{user.line.name}</span>
                        </div>
                      ) : (
                        <span className="text-body-sm text-on-surface-variant/60">Sin línea</span>
                      )}
                    </td>
                    {/* Role badge */}
                    <td className="px-4 py-4">
                      <Badge variant={user.role === 'ADMIN' ? 'primary' : 'secondary'}>
                        {user.role === 'ADMIN' ? 'Admin' : 'Operador'}
                      </Badge>
                    </td>
                    {/* Status badge */}
                    <td className="px-4 py-4">
                      <Badge variant={user.isActive ? 'success' : 'neutral'}>
                        {user.isActive ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)} aria-label={`Editar ${user.name}`}>
                          <Icon name="edit" size="sm" />
                        </Button>
                        {!isSelf(user.id) && user.isActive && (
                          <Button variant="ghost" size="sm" onClick={() => handleDeactivate(user)} aria-label={`Inactivar ${user.name}`}>
                            <Icon name="person_off" size="sm" className="text-warning" />
                          </Button>
                        )}
                        {!isSelf(user.id) && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(user)} aria-label={`Eliminar ${user.name}`}>
                            <Icon name="delete" size="sm" className="text-error" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create user modal */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Invitar usuario"
        description="Crea una cuenta nueva para un miembro del equipo"
        size="sm"
      >
        <form onSubmit={handleCreate} className="space-y-4 pt-2" noValidate>
          {createError && (
            <div
              role="alert"
              className="bg-error-container text-on-error-container rounded-xl px-4 py-3 flex items-center gap-2"
            >
              <Icon name="error" size="sm" />
              <span className="text-body-sm">{createError}</span>
            </div>
          )}
          <FormInput
            label="Nombre completo"
            floatingLabel
            value={createForm.name}
            onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
            required
            autoComplete="name"
          />
          <FormInput
            label="Nombre de usuario"
            floatingLabel
            type="text"
            value={createForm.username}
            onChange={(e) => setCreateForm((f) => ({ ...f, username: e.target.value }))}
            placeholder="ej: juan.perez"
            required
            autoComplete="username"
          />
          <FormInput
            label="Contraseña"
            floatingLabel
            type="password"
            value={createForm.password}
            onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
            required
            autoComplete="new-password"
          />
          <FormSelect
            label="Rol"
            value={createForm.role}
            onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="OPERATOR">Operador</option>
            <option value="ADMIN">Administrador</option>
          </FormSelect>
          <FormSelect
            label="Línea asignada"
            value={createForm.lineId}
            onChange={(e) => setCreateForm((f) => ({ ...f, lineId: e.target.value }))}
          >
            <option value="">Sin línea</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </FormSelect>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setShowCreateModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="md" loading={isCreating} disabled={isCreating}>
              Crear usuario
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit user modal */}
      <Modal
        open={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Editar: ${editingUser?.name ?? ''}`}
        size="sm"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 pt-2" noValidate>
          {editError && (
            <div
              role="alert"
              className="bg-error-container text-on-error-container rounded-xl px-4 py-3 flex items-center gap-2"
            >
              <Icon name="error" size="sm" />
              <span className="text-body-sm">{editError}</span>
            </div>
          )}
          <FormInput
            label="Nombre"
            floatingLabel
            value={editForm.name}
            onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <FormSelect
            label="Rol"
            value={editForm.role}
            onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
            disabled={editingUser ? isSelf(editingUser.id) : false}
          >
            <option value="OPERATOR">Operador</option>
            <option value="ADMIN">Administrador</option>
          </FormSelect>
          <FormSelect
            label="Estado"
            value={editForm.isActive ? 'active' : 'inactive'}
            onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.value === 'active' }))}
            disabled={editingUser ? isSelf(editingUser.id) : false}
          >
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </FormSelect>
          <FormSelect
            label="Línea asignada"
            value={editForm.lineId}
            onChange={(e) => setEditForm((f) => ({ ...f, lineId: e.target.value }))}
          >
            <option value="">Sin línea</option>
            {lines.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </FormSelect>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={() => setEditingUser(null)}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" size="md" loading={isSaving} disabled={isSaving}>
              Guardar cambios
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
