import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Card, Icon, SkeletonCard, cn } from '../ui';
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
      setHasError(false);
      try {
        const data = await apiFetchJson<{ contacts: Contact[] }>('/api/contacts');
        setContacts(data.contacts ?? []);
      } catch {
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      search === '' ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);

    const matchesTab =
      activeTab === 'all' ||
      (activeTab === 'open' && c.conversationStatus === 'OPEN') ||
      (activeTab === 'closed' && c.conversationStatus === 'CLOSED');

    return matchesSearch && matchesTab;
  });

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'open', label: 'Activos' },
    { id: 'closed', label: 'Cerrados' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-2">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div>
          <h1 className="text-heading-lg font-bold text-on-surface flex items-center gap-2">
            Contactos
            {!isLoading && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-caption font-semibold">
                {contacts.length}
              </span>
            )}
          </h1>
          <p className="text-on-surface-variant text-body mt-1">
            Todos los clientes que han escrito por WhatsApp
          </p>
        </div>
      </div>

      {/* Search + filters */}
      <Card variant="glass" className="p-4 space-y-3">
        <div className="relative">
          <Icon
            name="search"
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 pointer-events-none"
          />
          <input
            type="search"
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-surface-container rounded-xl border border-outline-variant/30 text-body text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-container rounded-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-1.5 px-3 rounded-lg text-body-sm font-medium transition-colors duration-200',
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-glass-sm'
                  : 'text-on-surface-variant hover:text-on-surface',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} className="h-20" />
          ))}
        </div>
      ) : hasError ? (
        <Card variant="glass" className="p-8 text-center">
          <Icon name="error_outline" size="lg" className="text-error/60 mx-auto mb-3" />
          <p className="text-on-surface font-medium">No se pudo cargar los contactos</p>
          <p className="text-on-surface-variant text-body-sm mt-1">
            Verifica tu conexión e intenta de nuevo.
          </p>
        </Card>
      ) : filtered.length === 0 ? (
        <Card variant="glass" className="p-10 text-center">
          <Icon name="contacts" size="lg" className="text-on-surface-variant/30 mx-auto mb-3" />
          <p className="text-on-surface font-medium">
            {search || activeTab !== 'all'
              ? 'No hay contactos que coincidan con los filtros'
              : 'No hay contactos todavía'}
          </p>
          <p className="text-on-surface-variant text-body-sm mt-1 max-w-xs mx-auto">
            {!search && activeTab === 'all'
              ? 'Los clientes que escriban por WhatsApp aparecerán aquí.'
              : 'Probá con otros criterios de búsqueda.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => navigate('/messages')}
              className="w-full text-left"
            >
              <Card
                variant="glass"
                className="p-4 hover:bg-surface-container/60 transition-colors duration-200 cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-body font-bold uppercase flex-shrink-0">
                    {(contact.name?.[0] ?? contact.phone[0] ?? '?').toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-on-surface text-body truncate">
                        {contact.name || contact.phone}
                      </span>
                      <span className="text-caption text-on-surface-variant/60 flex-shrink-0">
                        {timeAgo(contact.lastMsgAt)}
                      </span>
                    </div>

                    <p className="text-body-sm text-on-surface-variant/70 mt-0.5 truncate">
                      {contact.phone}
                    </p>

                    {contact.lastMsg && (
                      <p className="text-body-sm text-on-surface-variant mt-1 truncate">
                        {contact.lastMsg}
                      </p>
                    )}

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge
                        variant={contact.conversationStatus === 'OPEN' ? 'success' : 'secondary'}
                        size="sm"
                      >
                        {contact.conversationStatus === 'OPEN' ? 'Activo' : 'Cerrado'}
                      </Badge>

                      {contact.unreadCount > 0 && (
                        <Badge variant="primary" size="sm">
                          {contact.unreadCount} sin leer
                        </Badge>
                      )}

                      {contact.assignedTo && (
                        <span className="text-caption text-on-surface-variant/60">
                          Asignado a: {contact.assignedTo.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
