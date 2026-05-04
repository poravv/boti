import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, Icon, SkeletonCard, cn, Button } from '../ui';
import { apiFetchJson } from '../../lib/apiClient';

interface Contact {
  id: string;
  name: string;
  phone: string;
  lastMsg: string;
  lastMsgAt: string;
  conversationStatus: 'OPEN' | 'CLOSED';
  unreadCount: number;
  assignedTo: { id: string; name: string } | null;
  lineId?: string | null;
}

type FilterTab = 'all' | 'open' | 'closed';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

export function ContactsPage() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const data = await apiFetchJson<{ contacts: Contact[] }>('/api/contacts');
        setContacts(data.contacts ?? []);
      } catch { setHasError(true); } finally { setIsLoading(false); }
    };
    load();
  }, []);

  const filtered = contacts.filter((c) => {
    const matchesSearch = search === '' || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const matchesTab = activeTab === 'all' || (activeTab === 'open' && c.conversationStatus === 'OPEN') || (activeTab === 'closed' && c.conversationStatus === 'CLOSED');
    return matchesSearch && matchesTab;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-foreground tracking-tight">Directorio de Clientes</h1>
          <p className="text-muted-foreground mt-2 font-medium">Gestiona tu base de contactos unificada de WhatsApp.</p>
        </div>
        <div className="flex items-center gap-2">
           <Button variant="secondary" size="md" className="rounded-xl font-bold text-xs uppercase tracking-widest border border-border/50">
              <Icon name="file_download" size="xs" className="mr-2" /> EXPORTAR CSV
           </Button>
           <Button variant="primary" size="md" className="rounded-xl font-black text-xs uppercase tracking-widest shadow-premium">
              <Icon name="person_add" size="xs" className="mr-2" /> NUEVO CONTACTO
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="space-y-6">
           <Card variant="solid" className="p-2 border-none bg-muted/30">
              <div className="flex flex-col gap-1">
                 {[
                   { id: 'all', label: 'Todos los contactos', icon: 'groups' },
                   { id: 'open', label: 'Conversaciones Activas', icon: 'chat_bubble' },
                   { id: 'closed', label: 'Historial Cerrado', icon: 'history' }
                 ].map(tab => (
                   <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                      activeTab === tab.id ? "bg-white text-primary shadow-sm border border-border/50" : "text-muted-foreground hover:bg-white/50"
                    )}
                   >
                     <Icon name={tab.icon} size="sm" />
                     {tab.label}
                   </button>
                 ))}
              </div>
           </Card>

           <Card variant="solid" className="bg-primary/5 border-primary/10">
              <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">Segmentación</h4>
              <div className="space-y-2">
                 <div className="flex justify-between items-center text-xs font-bold text-foreground/70">
                    <span>Nuevos hoy</span>
                    <Badge variant="primary" size="sm">0</Badge>
                 </div>
                 <div className="flex justify-between items-center text-xs font-bold text-foreground/70">
                    <span>Sin respuesta</span>
                    <Badge variant="danger" size="sm">0</Badge>
                 </div>
              </div>
           </Card>
        </div>

        {/* List Content */}
        <div className="lg:col-span-3 space-y-6">
          <div className="relative group">
            <Icon name="search" size="sm" className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="search"
              placeholder="Busca por nombre, teléfono o mensaje..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-white border border-border/60 rounded-2xl shadow-sm text-sm font-medium focus:ring-4 focus:ring-primary/5 focus:border-primary/20 outline-none transition-all"
            />
          </div>

          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} className="h-24 rounded-3xl" />)
            ) : filtered.length === 0 ? (
              <Card variant="solid" className="py-20 flex flex-col items-center justify-center text-center space-y-4 border-dashed">
                 <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center">
                    <Icon name="search_off" size="lg" className="text-muted-foreground/30" />
                 </div>
                 <div>
                    <p className="font-bold text-foreground">No encontramos resultados</p>
                    <p className="text-xs text-muted-foreground font-medium">Intenta ajustando los filtros o la búsqueda.</p>
                 </div>
              </Card>
            ) : (
              filtered.map((contact) => (
                <Card 
                  key={contact.id} 
                  interactive 
                  className="p-5 flex items-center justify-between gap-4 group hover:-translate-y-0.5"
                  onClick={() => navigate('/messages')}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-variant flex items-center justify-center text-white font-black text-lg shadow-premium shrink-0">
                      {contact.name?.[0]?.toUpperCase() || contact.phone[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-foreground truncate">{contact.name || contact.phone}</h4>
                        {contact.unreadCount > 0 && <Badge variant="primary" size="sm" className="px-1.5 h-5 min-w-[20px] rounded-full">{contact.unreadCount}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium truncate max-w-[300px]">{contact.lastMsg || 'Sin mensajes previos'}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">{timeAgo(contact.lastMsgAt)}</span>
                    <div className="flex items-center gap-2">
                       <Badge variant={contact.conversationStatus === 'OPEN' ? 'success' : 'neutral'} size="sm">
                          {contact.conversationStatus === 'OPEN' ? 'ACTIVO' : 'CERRADO'}
                       </Badge>
                       <Icon name="chevron_right" size="sm" className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
