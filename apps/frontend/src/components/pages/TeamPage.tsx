import { useEffect, useState } from 'react';
import { Badge, Button, Card, FormInput, FormSelect, Icon, Modal, cn } from '../ui';
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

export function TeamPage({ currentUserId }: TeamPageProps) {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', username: '', password: '', role: 'OPERATOR', lineId: '' });

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const [userData, lineData] = await Promise.all([
        apiFetchJson<{ users: TeamUser[] }>('/api/users'),
        apiFetchJson<{ lines: { id: string; name: string }[] }>('/api/lines').catch(() => ({ lines: [] })),
      ]);
      setUsers(userData.users);
      setLines(lineData.lines);
    } catch (err: any) { console.error(err); } finally { setIsLoading(false); }
  };

  useEffect(() => { loadUsers(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      const res = await apiFetchJson<any>('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      setUsers((prev) => [...prev, res.user]);
      setShowCreateModal(false);
      setCreateForm({ name: '', username: '', password: '', role: 'OPERATOR', lineId: '' });
    } catch (err: any) { alert(err.message || 'Error al crear'); } finally { setIsCreating(false); }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Equipo & Operadores</h1>
          <p className="text-muted-foreground mt-2 font-medium">Administra quién gestiona tus canales y sus permisos.</p>
        </div>
        <Button variant="primary" size="lg" className="rounded-2xl font-black tracking-widest text-[10px] shadow-premium" onClick={() => setShowCreateModal(true)}>
          <Icon name="person_add" size="sm" className="mr-2" /> INVITAR OPERADOR
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6">
         <Card variant="solid" className="p-0 overflow-hidden border-none shadow-premium">
            <div className="overflow-x-auto">
               <table className="w-full">
                  <thead>
                     <tr className="bg-muted/30 border-b border-border/50">
                        <th className="px-8 py-5 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Miembro</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Asignación</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Rol</th>
                        <th className="px-6 py-5 text-left text-[10px] font-black text-muted-foreground uppercase tracking-widest">Estado</th>
                        <th className="px-8 py-5 text-right text-[10px] font-black text-muted-foreground uppercase tracking-widest">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                     {isLoading ? (
                       Array.from({ length: 3 }).map((_, i) => (
                         <tr key={i}>
                            <td colSpan={5} className="px-8 py-6"><div className="h-10 bg-muted animate-pulse rounded-xl w-full" /></td>
                         </tr>
                       ))
                     ) : users.map(user => (
                       <tr key={user.id} className="hover:bg-muted/10 transition-colors">
                          <td className="px-8 py-6">
                             <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-black">
                                   {user.name[0]}
                                </div>
                                <div>
                                   <p className="text-sm font-bold text-foreground">{user.name}</p>
                                   <p className="text-[10px] text-muted-foreground font-medium">@{user.username || 'sin-user'}</p>
                                </div>
                             </div>
                          </td>
                          <td className="px-6 py-6">
                             {user.line ? (
                               <div className="flex items-center gap-2 text-xs font-bold text-foreground/70">
                                  <Icon name="smartphone" size="xs" />
                                  {user.line.name}
                               </div>
                             ) : <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Sin asignar</span>}
                          </td>
                          <td className="px-6 py-6">
                             <Badge variant={user.role === 'ADMIN' ? 'primary' : 'neutral'} size="sm" className="font-black text-[10px]">{user.role}</Badge>
                          </td>
                          <td className="px-6 py-6">
                             <div className="flex items-center gap-2">
                                <div className={cn("w-2 h-2 rounded-full", user.isActive ? "bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]" : "bg-muted")} />
                                <span className="text-[10px] font-black text-foreground/60 uppercase">{user.isActive ? 'Activo' : 'Inactivo'}</span>
                             </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <div className="flex justify-end gap-2">
                                <button className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground"><Icon name="settings" size="xs" /></button>
                                <button className="p-2 hover:bg-danger/10 rounded-lg transition-colors text-danger/60"><Icon name="delete" size="xs" /></button>
                             </div>
                          </td>
                       </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </Card>
      </div>

      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Invitar Nuevo Operador" size="sm">
         <form onSubmit={handleCreate} className="space-y-6">
            <FormInput label="NOMBRE COMPLETO" value={createForm.name} onChange={(e) => setCreateForm({...createForm, name: e.target.value})} />
            <FormInput label="USUARIO" value={createForm.username} onChange={(e) => setCreateForm({...createForm, username: e.target.value})} />
            <FormInput label="CONTRASEÑA" type="password" value={createForm.password} onChange={(e) => setCreateForm({...createForm, password: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
               <FormSelect label="ROL" value={createForm.role} onChange={(e) => setCreateForm({...createForm, role: e.target.value})}>
                  <option value="OPERATOR">Operador</option>
                  <option value="ADMIN">Administrador</option>
               </FormSelect>
               <FormSelect label="LÍNEA" value={createForm.lineId} onChange={(e) => setCreateForm({...createForm, lineId: e.target.value})}>
                  <option value="">Cualquier línea</option>
                  {lines.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
               </FormSelect>
            </div>
            <Button variant="primary" size="lg" fullWidth loading={isCreating} type="submit">
               CREAR CUENTA DE ACCESO
            </Button>
         </form>
      </Modal>
    </div>
  );
}
