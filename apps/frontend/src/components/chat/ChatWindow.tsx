import { useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Badge } from '../ui/Badge';
import { ChatBubble } from './ChatBubble';
import { cn } from '../ui/cn';

interface Message {
  id: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  createdAt: string;
}

interface InternalNote {
  id: string;
  clientPhone: string;
  authorId: string;
  content: string;
  createdAt: string;
  author?: { id: string; name: string };
}

interface Chat {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
  status: string;
  aiPausedUntil?: string;
  conversationStatus?: 'OPEN' | 'CLOSED';
}

interface ChatWindowProps {
  chat: Chat | null;
  messages: Message[];
  notes: InternalNote[];
  loading?: boolean;
  onCloseChat: () => void;
  onPauseAI: (h: number) => void;
  onResumeAI: () => void;
  onCloseConversation: () => void;
  onReopenConversation: () => void;
  onClearAI: () => void;
  onDeleteNote: (id: string) => void;
}

export function ChatWindow({
  chat,
  messages,
  notes,
  loading,
  onCloseChat,
  onPauseAI,
  onResumeAI,
  onCloseConversation,
  onReopenConversation,
  onClearAI,
  onDeleteNote,
}: ChatWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, notes]);

  if (!chat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-muted/10">
        <div className="w-24 h-24 rounded-full bg-white shadow-premium flex items-center justify-center mb-6">
          <Icon name="chat_bubble" size="xl" className="text-primary/20" />
        </div>
        <h2 className="text-xl font-black text-foreground tracking-tight">Selecciona una conversación</h2>
        <p className="text-muted-foreground mt-2 max-w-xs mx-auto text-sm font-medium">
          Selecciona un chat de la lista de la izquierda para empezar a gestionar la atención.
        </p>
      </div>
    );
  }

  const isPaused = chat.aiPausedUntil && new Date(chat.aiPausedUntil) > new Date();

  const thread = [
    ...messages.map(m => ({ ...m, _kind: 'message' as const })),
    ...notes.map(n => ({ ...n, _kind: 'note' as const }))
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <div className="flex-1 flex flex-col h-full bg-white relative overflow-hidden">
      {/* Header */}
      <header className="px-6 py-4 border-b border-border flex items-center justify-between z-10 glass">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" className="md:hidden -ml-2" onClick={onCloseChat}>
            <Icon name="arrow_back" size="sm" />
          </Button>
          <div className="relative">
             <div className="w-10 h-10 rounded-full border-2 border-white shadow-premium overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-primary text-xs uppercase">
               {chat.avatarUrl ? <img src={chat.avatarUrl} alt="" className="w-full h-full object-cover" /> : chat.name?.[0] || chat.phone[0]}
             </div>
             <div className={cn(
               "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white shadow-sm",
               chat.conversationStatus === 'OPEN' ? "bg-success" : "bg-muted-foreground"
             )} />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-sm leading-none">{chat.name || chat.phone}</h3>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-1">
              {chat.conversationStatus === 'OPEN' ? 'Conversación Abierta' : 'Cerrada'} · {chat.phone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClearAI} title="Reset Contexto IA">
            <Icon name="refresh" size="sm" />
          </Button>
          
          <Button 
            variant={isPaused ? 'primary' : 'secondary'} 
            size="sm" 
            className="h-8 text-[10px] font-bold px-3"
            onClick={() => isPaused ? onResumeAI() : onPauseAI(1)}
          >
            {isPaused ? 'REANUDAR IA' : 'PAUSAR IA'}
          </Button>

          {chat.conversationStatus === 'OPEN' ? (
             <Button variant="secondary" size="sm" className="h-8 text-[10px] font-bold px-3" onClick={onCloseConversation}>
               CERRAR CASO
             </Button>
          ) : (
            <Button variant="primary" size="sm" className="h-8 text-[10px] font-bold px-3" onClick={onReopenConversation}>
              REABRIR
            </Button>
          )}
        </div>
      </header>

      {/* Messages Thread */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 md:p-10 space-y-2 bg-[#f8fafc] custom-scrollbar"
      >
        {loading ? (
          <div className="space-y-6">
            <div className="w-2/3 h-12 bg-white rounded-2xl animate-pulse" />
            <div className="w-1/2 h-12 bg-primary/10 rounded-2xl animate-pulse ml-auto" />
            <div className="w-3/4 h-12 bg-white rounded-2xl animate-pulse" />
          </div>
        ) : thread.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-30 text-center">
            <Icon name="message_square" size="xl" className="mb-2" />
            <p className="text-sm font-bold uppercase tracking-widest">Sin mensajes previos</p>
          </div>
        ) : (
          thread.map((item, i) => (
            <ChatBubble
              key={item.id}
              content={item.content}
              direction={(item as Message).direction}
              time={new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              isNote={item._kind === 'note'}
              authorName={(item as InternalNote).author?.name}
              onDeleteNote={() => onDeleteNote(item.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
