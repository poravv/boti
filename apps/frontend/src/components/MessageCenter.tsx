import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, apiFetchJson } from '../lib/apiClient';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FormInput,
  FormSelect,
  Icon,
  Skeleton,
  SkeletonCard,
  SkeletonText,
  cn,
} from './ui';

interface Chat {
  id: string;
  name: string;
  phone: string;
  lastMsg: string;
  time: string;
  status: string;
  aiPausedUntil?: string;
  assignedTo?: { id: string; name: string; email: string };
  unreadCount?: number;
  lineId?: string;
}

interface Agent {
  id: string;
  name: string;
  role: string;
}

interface Message {
  id: string;
  content: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  createdAt: string;
}

const displayName = (name: string, phone: string) =>
  name && name !== phone ? name : phone.replace(/\D/g, '').slice(-10);

const MessageCenter = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [oldestId, setOldestId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Ref kept in sync so WS handler always reads latest activeChat without re-registering.
  const activeChatRef = useRef<Chat | null>(null);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = useCallback(async () => {
    try {
      const data = await apiFetchJson<{ chats: Chat[] }>('/api/chats');
      setChats(data.chats || []);
      // Use ref so this callback stays stable but still reads the latest value.
      if (data.chats?.length > 0 && !activeChatRef.current) {
        setActiveChat(data.chats[0]);
      }
    } catch {
      // Silent: chat list falls back to previous state.
    } finally {
      setLoadingChats(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await apiFetchJson<{ agents: Agent[] }>('/api/agents');
      setAgents(data.agents || []);
    } catch {
      // Agents list is optional.
    }
  }, []);

  const fetchMessages = useCallback(async (phone: string) => {
    setLoadingMessages(true);
    try {
      const data = await apiFetchJson<{ messages: Message[]; hasMore: boolean }>(`/api/messages/${phone}?limit=30`);
      const msgs = data.messages || [];
      setMessages(msgs);
      setHasMore(data.hasMore ?? false);
      setOldestId(msgs.length > 0 ? msgs[0].id : null);
      setTimeout(scrollToBottom, 100);
    } catch {
      // Preserve previous thread on network error.
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const loadMoreMessages = useCallback(async (phone: string) => {
    if (!oldestId || loadingMore) return;
    setLoadingMore(true);
    const container = messagesContainerRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    try {
      const data = await apiFetchJson<{ messages: Message[]; hasMore: boolean }>(
        `/api/messages/${phone}?limit=30&before=${oldestId}`,
      );
      const older = data.messages || [];
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setOldestId(older[0].id);
        setTimeout(() => {
          if (container) container.scrollTop = container.scrollHeight - prevHeight;
        }, 50);
      }
      setHasMore(data.hasMore ?? false);
    } catch {
      // Keep existing messages on error.
    } finally {
      setLoadingMore(false);
    }
  }, [oldestId, loadingMore]);

  useEffect(() => {
    fetchChats();
    fetchAgents();
  }, [fetchChats, fetchAgents]);

  useEffect(() => {
    if (!activeChat) return;
    fetchMessages(activeChat.phone);
    apiFetch(`/api/messages/${activeChat.phone}/read`, { method: 'POST' }).then(() => {
      window.dispatchEvent(new CustomEvent('boti:fetch-unread'));
      setChats((prev) =>
        prev.map((c) => (c.phone === activeChat.phone ? { ...c, unreadCount: 0 } : c)),
      );
    }).catch(() => {});
  }, [activeChat?.id, fetchMessages]);

  useEffect(() => {
    const handleWSEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ event: string; data?: Record<string, unknown>; payload?: Record<string, unknown> }>).detail;
      if (!detail) return;
      const body = (detail.data || detail.payload || {}) as Record<string, unknown>;

      if (
        detail.event === 'message:new' ||
        detail.event === 'message:status' ||
        detail.event === 'operator:notification'
      ) {
        fetchChats();

        let phone = (body.fromPhone || body.clientPhone || body.remoteJid || body.to) as
          | string
          | undefined;
        if (phone && typeof phone === 'string') {
          phone = phone.split('@')[0].split(':')[0];
          const current = activeChatRef.current;
          if (current && phone === current.phone) {
            fetchMessages(current.phone);
            if (detail.event === 'message:new') {
              apiFetch(`/api/messages/${current.phone}/read`, { method: 'POST' })
                .then(() => window.dispatchEvent(new CustomEvent('boti:fetch-unread')))
                .catch(() => {});
            }
          }
        }
      }
    };

    // Registered once — activeChatRef ensures always-fresh activeChat without re-registration.
    window.addEventListener('boti:ws-event', handleWSEvent);
    return () => window.removeEventListener('boti:ws-event', handleWSEvent);
  }, [fetchChats, fetchMessages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;
    if (!activeChat.lineId) return;
    try {
      await apiFetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineId: activeChat.lineId,
          to: activeChat.phone,
          content: newMessage,
          type: 'TEXT',
        }),
      });
      setNewMessage('');
      // Fetch immediately (optimistic) and again after BullMQ processes the job.
      fetchMessages(activeChat.phone);
      setTimeout(() => fetchMessages(activeChat.phone), 1500);
    } catch {
      // Compose state preserved for retry.
    }
  };

  const handlePauseAI = async (hours: number) => {
    if (!activeChat) return;
    try {
      const data = await apiFetchJson<{ pausedUntil: string }>(`/api/clients/${activeChat.phone}/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours }),
      });
      setActiveChat({ ...activeChat, aiPausedUntil: data.pausedUntil });
    } catch {
      // UI falls back to previous state.
    }
  };

  const handleAssignAgent = async (agentId: string | null) => {
    if (!activeChat) return;
    try {
      await apiFetch(`/api/clients/${activeChat.phone}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      fetchChats();
      const agent = agents.find((a) => a.id === agentId);
      setActiveChat({
        ...activeChat,
        assignedTo: agent ? { id: agent.id, name: agent.name, email: '' } : undefined,
      });
    } catch {
      // Assignment retained optimistically on error.
    }
  };

  const isAiCurrentlyPaused =
    !!activeChat?.aiPausedUntil && new Date(activeChat.aiPausedUntil) > new Date();

  const filteredChats = searchTerm
    ? chats.filter(
        (chat) =>
          chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          chat.phone.includes(searchTerm),
      )
    : chats;

  return (
    <div className="flex h-[calc(100vh-6rem)] -mx-4 md:-mx-6 overflow-hidden bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-glass-sm">
      <aside
        aria-label="Lista de conversaciones"
        className="w-80 border-r border-outline-variant/40 flex flex-col bg-white"
      >
        <div className="p-3 border-b border-outline-variant/30">
          <FormInput
            aria-label="Buscar conversaciones"
            placeholder="Buscar conversaciones..."
            leadingIcon="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingChats ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="flex gap-3 p-3 rounded-xl bg-surface-container-low/60"
                >
                  <Skeleton width={40} height={40} rounded="full" />
                  <div className="flex-1">
                    <Skeleton height={12} width="70%" />
                    <Skeleton height={10} width="50%" className="mt-2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredChats.length === 0 ? (
            <EmptyState
              icon="chat"
              title="Sin conversaciones"
              description="Aún no hay clientes que coincidan con tu búsqueda."
            />
          ) : (
            <ul className="py-1">
              {filteredChats.map((chat, index) => {
                const isActive = activeChat?.id === chat.id;
                const unread = chat.unreadCount || 0;
                return (
                  <li
                    key={chat.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveChat(chat)}
                      aria-current={isActive ? 'true' : undefined}
                      className={cn(
                        'w-full px-3 py-3 flex gap-3 items-center text-left transition-colors duration-250 ease-premium focus-ring border-l-2',
                        isActive
                          ? 'bg-primary/5 border-l-primary'
                          : 'border-l-transparent hover:bg-surface-container-low',
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-surface-container-high flex-shrink-0 flex items-center justify-center text-on-surface-variant font-semibold text-body-sm border border-outline-variant/40">
                        {(chat.name && chat.name !== chat.phone ? chat.name : chat.phone).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <p className="text-body-sm font-semibold text-on-surface truncate">
                            {displayName(chat.name, chat.phone)}
                          </p>
                          <span className="text-overline text-on-surface-variant flex-shrink-0">
                            {new Date(chat.time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-caption text-on-surface-variant truncate">
                          {chat.lastMsg}
                        </p>
                        {chat.assignedTo && (
                          <div className="mt-1 flex items-center gap-1">
                            <Badge variant="primary" size="sm">
                              <Icon name="person" size="xs" />
                              {chat.assignedTo.name}
                            </Badge>
                          </div>
                        )}
                      </div>
                      {unread > 0 && (
                        <span
                          aria-label={`${unread} sin leer`}
                          className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-on-primary text-overline flex items-center justify-center animate-pulse-soft"
                        >
                          {unread}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <section className="flex-1 flex flex-col relative min-w-0">
        {activeChat ? (
          <>
            <header className="px-4 md:px-6 py-3 bg-white/80 backdrop-blur-xl border-b border-outline-variant/40 flex justify-between items-center gap-3 z-sticky">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-on-primary font-semibold shadow-glass-sm flex-shrink-0">
                  {(activeChat.name && activeChat.name !== activeChat.phone ? activeChat.name : activeChat.phone).charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  {editingName ? (
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!nameInput.trim() || !activeChat) return;
                      try {
                        await apiFetch(`/api/clients/${activeChat.phone}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ name: nameInput.trim() }),
                        });
                        setChats(prev => prev.map(c => c.phone === activeChat.phone ? { ...c, name: nameInput.trim() } : c));
                        setActiveChat(prev => prev ? { ...prev, name: nameInput.trim() } : prev);
                        setEditingName(false);
                      } catch { setEditingName(false); }
                    }} className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        className="px-2 py-1 rounded-lg border border-outline-variant/40 bg-surface text-on-surface text-body font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30 w-40"
                      />
                      <button type="submit" className="p-1 rounded-lg hover:bg-success/10 text-success"><Icon name="check" size="sm" /></button>
                      <button type="button" onClick={() => setEditingName(false)} className="p-1 rounded-lg hover:bg-error/10 text-error"><Icon name="close" size="sm" /></button>
                    </form>
                  ) : (
                    <button onClick={() => { setNameInput(activeChat.name || ''); setEditingName(true); }} className="font-semibold text-on-surface hover:text-primary transition-colors text-left">
                      {displayName(activeChat.name, activeChat.phone)}
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <Badge variant="success" dot />
                    <span className="text-overline text-on-surface-variant uppercase truncate">
                      Activo · {activeChat.phone}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <FormSelect
                  aria-label="Asignar agente"
                  value={activeChat.assignedTo?.id || ''}
                  onChange={(event) => handleAssignAgent(event.target.value || null)}
                  containerClassName="w-36"
                >
                  <option value="">Sin asignar</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </FormSelect>

                <Button
                  variant={isAiCurrentlyPaused ? 'primary' : 'secondary'}
                  size="sm"
                  leadingIcon={isAiCurrentlyPaused ? 'play_circle' : 'pause_circle'}
                  onClick={() => handlePauseAI(1)}
                  className={cn(
                    isAiCurrentlyPaused &&
                      'bg-warning text-on-warning shadow-glass-sm hover:bg-warning/90',
                  )}
                >
                  {isAiCurrentlyPaused ? 'Reanudar IA' : 'Pausar IA 1H'}
                </Button>
              </div>
            </header>

            {isAiCurrentlyPaused && (
              <Card
                variant="solid"
                padding="sm"
                className="mx-4 md:mx-6 mt-3 bg-warning-container border-warning/20 text-on-warning-container"
              >
                <div className="flex items-center gap-2">
                  <Icon name="warning" size="sm" />
                  <p className="text-body-sm">
                    Chatbot pausado para atención manual hasta{' '}
                    {new Date(activeChat.aiPausedUntil!).toLocaleTimeString()}
                  </p>
                </div>
              </Card>
            )}

            <div
              ref={messagesContainerRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              aria-label={`Conversación con ${displayName(activeChat.name, activeChat.phone)}`}
              className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-4 bg-surface-container-lowest"
            >
              {hasMore && !loadingMore && (
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    className="text-body-sm text-primary bg-primary/8 hover:bg-primary/12 px-4 py-1.5 rounded-full transition-colors"
                    onClick={() => loadMoreMessages(activeChat.phone)}
                  >
                    Cargar mensajes anteriores
                  </button>
                </div>
              )}
              {loadingMore && (
                <div className="flex justify-center py-2">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              {loadingMessages ? (
                <div className="space-y-4">
                  <SkeletonText lines={2} />
                  <SkeletonText lines={3} className="ml-auto max-w-[60%]" />
                  <SkeletonText lines={2} />
                </div>
              ) : (
                messages.map((message, index) => (
                  <MessageBubble
                    key={message.id}
                    sent={message.direction === 'OUTBOUND'}
                    text={message.content}
                    time={new Date(message.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    isAi={message.direction === 'OUTBOUND'}
                    delay={Math.min(index, 10) * 30}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <footer className="p-4 md:p-5 bg-white border-t border-outline-variant/40">
              <div className="max-w-4xl mx-auto flex items-center gap-2 bg-surface-container-low rounded-2xl px-4 py-2 border border-outline-variant/40">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Escribe un mensaje..."
                  aria-label="Escribe un mensaje"
                  className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-body text-on-surface placeholder:text-on-surface-variant/70 py-1"
                />
                <Button
                  variant="primary"
                  size="md"
                  aria-label="Enviar mensaje"
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  leadingIcon="send"
                >
                  Enviar
                </Button>
              </div>
            </footer>
          </>
        ) : loadingChats ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <SkeletonCard className="max-w-md w-full" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
            <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center">
              <Icon name="forum" size="xl" className="text-on-surface-variant/40" />
            </div>
            <div>
              <p className="text-on-surface font-medium">Selecciona una conversación</p>
              <p className="text-on-surface-variant text-body-sm mt-1">Elige un contacto de la lista para ver sus mensajes</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

interface MessageBubbleProps {
  sent: boolean;
  text: string;
  time: string;
  isAi: boolean;
  delay: number;
}

const MessageBubble = ({ sent, text, time, isAi, delay }: MessageBubbleProps) => (
  <div
    className={cn('flex animate-fade-in-up', sent ? 'justify-end' : 'justify-start')}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="max-w-[80%]">
      <div
        className={cn(
          'px-4 py-3 rounded-2xl shadow-glass-sm border',
          sent
            ? 'bg-primary text-on-primary border-primary rounded-tr-sm'
            : 'bg-surface-container text-on-surface border-outline-variant/40 rounded-tl-sm',
        )}
      >
        {isAi && (
          <div className="flex items-center gap-1.5 mb-1.5 opacity-80">
            <Icon name="auto_awesome" size="xs" />
            <span className="text-overline uppercase">Inteligencia Artificial</span>
          </div>
        )}
        <p className="text-body leading-relaxed whitespace-pre-wrap">{text}</p>
        <div
          className={cn(
            'text-overline mt-2 flex items-center justify-end gap-1',
            sent ? 'text-on-primary/70' : 'text-on-surface-variant',
          )}
        >
          {time}
          {sent && <Icon name="done_all" size="xs" />}
        </div>
      </div>
    </div>
  </div>
);

export default MessageCenter;
