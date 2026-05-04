import { Badge } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { cn } from '../ui/cn';

interface Chat {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  lastMsg: string;
  time: string;
  status: string;
  unreadCount?: number;
  conversationStatus?: 'OPEN' | 'CLOSED';
}

interface ChatListProps {
  chats: Chat[];
  activeChatId?: string;
  loading?: boolean;
  onSelectChat: (chat: Chat) => void;
  searchTerm: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onFilterChange: (tab: any) => void;
}

const displayName = (name: string, phone: string) =>
  name && name !== phone ? name : phone.replace(/\D/g, '').slice(-10);

export function ChatList({
  chats,
  activeChatId,
  loading,
  onSelectChat,
  searchTerm,
  onSearchChange,
  statusFilter,
  onFilterChange,
}: ChatListProps) {
  return (
    <aside className="flex flex-col w-full md:w-80 h-full bg-white border-r border-border">
      {/* Search Header */}
      <div className="p-4 border-b border-border">
        <div className="relative group">
          <Icon name="search" size="sm" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Buscar chats..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-muted/50 border border-transparent focus:border-primary/20 focus:bg-white focus:ring-4 focus:ring-primary/5 rounded-xl pl-10 pr-4 py-2.5 text-sm transition-all outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3 py-2 flex gap-1 bg-muted/30 border-b border-border">
        {(['OPEN', 'CLOSED', 'UNASSIGNED'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => onFilterChange(tab)}
            className={cn(
              "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
              statusFilter === tab
                ? "bg-white text-primary shadow-sm border border-primary/10"
                : "text-muted-foreground hover:bg-white/50 hover:text-foreground"
            )}
          >
            {tab === 'OPEN' ? 'Abiertos' : tab === 'CLOSED' ? 'Cerrados' : 'Libres'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex gap-3 animate-pulse">
                <div className="w-12 h-12 bg-muted rounded-full" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-2 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center opacity-40">
            <Icon name="chat_bubble" size="xl" className="mb-2" />
            <p className="text-sm font-bold uppercase tracking-widest">Sin conversaciones</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {chats.map((chat) => {
              const isActive = activeChatId === chat.id;
              const isUnread = (chat.unreadCount || 0) > 0;
              
              return (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={cn(
                    "w-full px-4 py-4 flex gap-4 items-center text-left transition-all relative group",
                    isActive 
                      ? "bg-primary/5" 
                      : "hover:bg-muted/50"
                  )}
                >
                  {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}
                  
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-sm bg-muted flex items-center justify-center text-muted-foreground font-bold text-sm uppercase">
                      {chat.avatarUrl ? (
                        <img src={chat.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        displayName(chat.name, chat.phone)[0]
                      )}
                    </div>
                    {chat.conversationStatus === 'OPEN' && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success border-2 border-white rounded-full shadow-sm" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline gap-2 mb-0.5">
                      <p className={cn(
                        "text-sm truncate",
                        isUnread ? "font-bold text-foreground" : "font-semibold text-muted-foreground group-hover:text-foreground"
                      )}>
                        {displayName(chat.name, chat.phone)}
                      </p>
                      <span className="text-[10px] font-bold text-muted-foreground/60 whitespace-nowrap">
                        {new Date(chat.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={cn(
                      "text-xs truncate",
                      isUnread ? "text-foreground/80 font-medium" : "text-muted-foreground/70"
                    )}>
                      {chat.lastMsg}
                    </p>
                  </div>

                  {isUnread && (
                    <Badge variant="primary" size="sm" className="h-5 min-w-[20px] rounded-md shadow-sm">
                      {chat.unreadCount}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
