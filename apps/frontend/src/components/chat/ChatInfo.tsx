import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';

interface Agent {
  id: string;
  name: string;
}

interface Chat {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  assignedTo?: { id: string; name: string };
  lineId?: string;
}

interface ChatInfoProps {
  chat: Chat;
  agents: Agent[];
  onAssign: (agentId: string | null) => void;
}

export function ChatInfo({ chat, agents, onAssign }: ChatInfoProps) {
  return (
    <aside className="w-72 border-l border-border bg-white flex flex-col h-full hidden xl:flex">
      <div className="p-6 flex flex-col items-center text-center border-b border-border">
        <div className="w-24 h-24 rounded-2xl border-4 border-white shadow-premium overflow-hidden bg-muted mb-4">
          {chat.avatarUrl ? (
            <img src={chat.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-black text-muted-foreground uppercase">
              {chat.name?.[0] || chat.phone[0]}
            </div>
          )}
        </div>
        <h3 className="text-lg font-black text-foreground tracking-tight">{chat.name || 'Sin nombre'}</h3>
        <p className="text-xs font-bold text-muted-foreground mt-1">{chat.phone}</p>
        
        <div className="mt-4 flex gap-2">
           <Badge variant="success" size="sm">Cliente Verificado</Badge>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8">
        {/* Asignación */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Asignación</h4>
          <div className="space-y-2">
            <select
              value={chat.assignedTo?.id || ''}
              onChange={(e) => onAssign(e.target.value || null)}
              className="w-full bg-muted/50 border border-transparent focus:border-primary/20 focus:bg-white focus:ring-4 focus:ring-primary/5 rounded-xl px-3 py-2.5 text-xs font-bold transition-all outline-none"
            >
              <option value="">Sin asignar</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
            {chat.assignedTo && (
              <p className="text-[10px] text-muted-foreground font-medium italic">
                Asignado actualmente a <span className="text-primary font-bold">{chat.assignedTo.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Detalles Técnicos */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Detalles</h4>
          <div className="space-y-3">
             <div className="flex justify-between items-center">
               <span className="text-xs text-muted-foreground font-medium">Line ID</span>
               <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono font-bold">{chat.lineId || 'N/A'}</code>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-xs text-muted-foreground font-medium">Canal</span>
               <Badge variant="primary" size="sm">WhatsApp</Badge>
             </div>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div className="space-y-4">
          <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Acciones rápidas</h4>
          <div className="grid grid-cols-2 gap-2">
             <Button variant="secondary" size="sm" className="h-9 text-[10px] font-bold">
               <Icon name="block" size="xs" className="mr-1" /> BLOCK
             </Button>
             <Button variant="secondary" size="sm" className="h-9 text-[10px] font-bold">
               <Icon name="mail" size="xs" className="mr-1" /> EMAIL
             </Button>
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-border">
        <Button variant="ghost" size="sm" fullWidth className="text-muted-foreground hover:text-error">
           <Icon name="delete" size="xs" className="mr-2" /> Eliminar contacto
        </Button>
      </div>
    </aside>
  );
}
