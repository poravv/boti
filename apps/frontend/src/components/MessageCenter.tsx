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
  conversationStatus?: 'OPEN' | 'CLOSED';
  closedAt?: string | null;
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

interface InternalNote {
  id: string;
  clientPhone: string;
  authorId: string;
  content: string;
  createdAt: string;
  author?: { id: string; name: string };
}

type ThreadItem = (Message & { _kind: 'message' }) | (InternalNote & { _kind: 'note' });

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
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'CLOSED' | 'ALL' | 'UNASSIGNED'>('OPEN');
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [noteMode, setNoteMode] = useState(false);
  const [newNote, setNewNote] = useState('');
  // Mobile: track which panel is visible (sidebar vs conversation).
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  // Ref kept in sync so WS handler always reads latest activeChat without re-registering.
  const activeChatRef = useRef<Chat | null>(null);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = useCallback(async (filter?: 'OPEN' | 'CLOSED' | 'ALL' | 'UNASSIGNED') => {
    const status = filter ?? statusFilter;
    // UNASSIGNED is a client-side filter on top of OPEN chats.
    const apiStatus = status === 'UNASSIGNED' ? 'OPEN' : status;
    try {
      const data = await apiFetchJson<{ chats: Chat[] }>(`/api/chats?status=${apiStatus}`);
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
  }, [statusFilter]);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await apiFetchJson<{ agents: Agent[] }>('/api/agents');
      setAgents(data.agents || []);
    } catch {
      // Agents list is optional.
    }
  }, []);

  const fetchNotes = useCallback(async (phone: string) => {
    try {
      const data = await apiFetchJson<{ notes: InternalNote[] }>(`/api/clients/${phone}/notes`);
      setNotes(data.notes || []);
    } catch { /* keep previous notes */ }
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

  // Silent variant — used for background syncs triggered by WS events.
  // Does NOT set loadingMessages to avoid showing the spinner mid-conversation.
  const fetchMessagesBackground = useCallback(async (phone: string) => {
    try {
      const data = await apiFetchJson<{ messages: Message[]; hasMore: boolean }>(`/api/messages/${phone}?limit=30`);
      const msgs = data.messages || [];
      setMessages(msgs);
      setHasMore(data.hasMore ?? false);
      setOldestId(msgs.length > 0 ? msgs[0].id : null);
      setTimeout(scrollToBottom, 100);
    } catch {
      // Preserve existing messages on error.
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
    fetchNotes(activeChat.phone);
    apiFetch(`/api/messages/${activeChat.phone}/read`, { method: 'POST' }).then(() => {
      window.dispatchEvent(new CustomEvent('boti:fetch-unread'));
      setChats((prev) =>
        prev.map((c) => (c.phone === activeChat.phone ? { ...c, unreadCount: 0 } : c)),
      );
    }).catch(() => {});
  }, [activeChat?.id, fetchMessages, fetchNotes]);

  useEffect(() => {
    const handleWSEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ event: string; data?: Record<string, unknown>; payload?: Record<string, unknown> }>).detail;
      if (!detail) return;
      const body = (detail.data || detail.payload || {}) as Record<string, unknown>;

      if (detail.event === 'conversation:status') {
        const phone = (body.phone) as string | undefined;
        const status = (body.status) as 'OPEN' | 'CLOSED' | undefined;
        if (phone && status) {
          setChats((prev) =>
            prev.map((c) => c.phone === phone ? { ...c, conversationStatus: status } : c),
          );
          if (activeChatRef.current?.phone === phone) {
            setActiveChat((prev) => prev ? { ...prev, conversationStatus: status } : prev);
          }
        }
        return;
      }

      if (detail.event === 'note:new') {
        const notePkg = body.note as InternalNote | undefined;
        if (notePkg && activeChatRef.current?.phone === notePkg.clientPhone) {
          setNotes((prev) => {
            if (prev.find((n) => n.id === notePkg.id)) return prev;
            return [...prev, notePkg];
          });
        }
        return;
      }

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
            if (detail.event === 'message:new') {
              const isOutbound = body.direction === 'OUTBOUND';

              if (isOutbound) {
                // Outbound AI reply: BullMQ broadcasts AFTER the DB write, so fetch is safe.
                fetchMessages(current.phone);
              } else {
                // Inbound: backend broadcasts BEFORE the DB write (3s debounce).
                // fetchMessages() would return stale data — inject the message from the WS
                // payload directly so the user sees it instantly.
                if (body.content !== undefined) {
                  const incomingContent = String(body.content);
                  setMessages(prev => {
                    // Skip if same content arrived within last 5s (dedup guard).
                    const alreadyPresent = prev.some(
                      m => m.content === incomingContent &&
                        m.direction === 'INBOUND' &&
                        Date.now() - new Date(m.createdAt).getTime() < 5000,
                    );
                    if (alreadyPresent) return prev;
                    return [
                      ...prev,
                      {
                        id: `ws-${Date.now()}`,
                        content: incomingContent,
                        direction: 'INBOUND' as const,
                        type: String(body.type || 'TEXT'),
                        createdAt: new Date().toISOString(),
                      },
                    ];
                  });
                  setTimeout(scrollToBottom, 50);
                }
                // Fallback: if no outbound event fires (AI paused / error),
                // sync from DB after debounce + buffer so the real ID replaces the temp one.
                setTimeout(() => {
                  if (activeChatRef.current?.phone === current.phone) {
                    fetchMessagesBackground(current.phone);
                  }
                }, 5000);
              }

              apiFetch(`/api/messages/${current.phone}/read`, { method: 'POST' })
                .then(() => window.dispatchEvent(new CustomEvent('boti:fetch-unread')))
                .catch(() => {});
            } else {
              // message:status / operator:notification — DB already up-to-date.
              fetchMessages(current.phone);
            }
          }
        }
      }
    };

    // Registered once — activeChatRef ensures always-fresh activeChat without re-registration.
    window.addEventListener('boti:ws-event', handleWSEvent);
    return () => window.removeEventListener('boti:ws-event', handleWSEvent);
  }, [fetchChats, fetchMessages, fetchMessagesBackground]);

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

  const handleResumeAI = async () => {
    if (!activeChat) return;
    try {
      await apiFetch(`/api/clients/${activeChat.phone}/unpause`, { method: 'POST' });
      setActiveChat({ ...activeChat, aiPausedUntil: undefined });
      setChats(prev => prev.map(c => c.phone === activeChat.phone ? { ...c, aiPausedUntil: undefined } : c));
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

  const handleCloseConversation = async () => {
    if (!activeChat) return;
    try {
      await apiFetch(`/api/clients/${activeChat.phone}/close`, { method: 'POST' });
      const updated = { ...activeChat, conversationStatus: 'CLOSED' as const, closedAt: new Date().toISOString() };
      setActiveChat(updated);
      setChats((prev) => prev.map((c) => c.phone === activeChat.phone ? updated : c));
    } catch { /* keep state */ }
  };

  const handleReopenConversation = async () => {
    if (!activeChat) return;
    try {
      await apiFetch(`/api/clients/${activeChat.phone}/reopen`, { method: 'POST' });
      const updated = { ...activeChat, conversationStatus: 'OPEN' as const, closedAt: null };
      setActiveChat(updated);
      setChats((prev) => prev.map((c) => c.phone === activeChat.phone ? updated : c));
    } catch { /* keep state */ }
  };

  const handleClearAIContext = async () => {
    if (!activeChat?.lineId) return;
    if (!window.confirm('¿Limpiar el contexto de IA para esta conversación? El bot olvidará el historial reciente y empezará desde cero.')) return;
    try {
      await apiFetch(`/api/lines/${activeChat.lineId}/context/${activeChat.phone}`, { method: 'DELETE' });
      alert('Contexto de IA limpiado. El bot empezará desde cero en el próximo mensaje.');
    } catch { alert('Error al limpiar el contexto.'); }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!activeChat) return;
    try {
      await apiFetch(`/api/clients/${activeChat.phone}/notes/${noteId}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch { /* keep note on error */ }
  };

  const handleSendNote = async () => {
    if (!newNote.trim() || !activeChat) return;
    try {
      const data = await apiFetchJson<{ note: InternalNote }>(`/api/clients/${activeChat.phone}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      });
      setNotes((prev) => [...prev, data.note]);
      setNewNote('');
    } catch { /* keep draft */ }
  };

  const isAiCurrentlyPaused =
    !!activeChat?.aiPausedUntil && new Date(activeChat.aiPausedUntil) > new Date();

  const baseChats = statusFilter === 'UNASSIGNED' ? chats.filter((c) => !c.assignedTo) : chats;
  const filteredChats = searchTerm
    ? baseChats.filter(
        (chat) =>
          chat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          chat.phone.includes(searchTerm),
      )
    : baseChats;

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-[calc(100vh-6rem)] -mx-4 md:-mx-6 overflow-hidden bg-surface-container-lowest rounded-2xl border border-outline-variant/40 shadow-glass-sm">
      <aside
        aria-label="Lista de conversaciones"
        className={cn(
          'border-r border-outline-variant/40 flex-col bg-white',
          mobileShowChat ? 'hidden md:flex md:w-80' : 'flex w-full md:w-80',
        )}
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
        <div className="px-3 py-2 flex gap-1 border-b border-outline-variant/30">
          {(['OPEN', 'CLOSED', 'ALL', 'UNASSIGNED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setStatusFilter(tab)}
              className={cn(
                'flex-1 py-1 rounded-lg text-[10px] font-medium transition-colors',
                statusFilter === tab
                  ? 'bg-primary text-white'
                  : 'text-on-surface-variant hover:bg-surface-container-low',
              )}
            >
              {tab === 'OPEN' ? 'Abiertas' : tab === 'CLOSED' ? 'Cerradas' : tab === 'ALL' ? 'Todas' : 'Sin asignar'}
            </button>
          ))}
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
                      onClick={() => { setActiveChat(chat); setMobileShowChat(true); }}
                      aria-current={isActive ? 'true' : undefined}
                      className={cn(
                        'w-full px-3 py-3 flex gap-3 items-center text-left transition-colors duration-250 ease-premium focus-ring border-l-2',
                        isActive
                          ? 'bg-primary/5 border-l-primary'
                          : 'border-l-transparent hover:bg-surface-container-low',
                        chat.conversationStatus === 'CLOSED' ? 'opacity-60' : '',
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-surface-container-high flex-shrink-0 flex items-center justify-center text-on-surface-variant font-semibold text-body-sm border border-outline-variant/40">
                        {(chat.name && chat.name !== chat.phone ? chat.name : chat.phone).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline gap-2">
                          <div className="flex items-center gap-1 min-w-0">
                            <p className="text-body-sm font-semibold text-on-surface truncate">
                              {displayName(chat.name, chat.phone)}
                            </p>
                            {chat.conversationStatus === 'CLOSED' && (
                              <Icon name="lock" size="xs" className="text-on-surface-variant flex-shrink-0" />
                            )}
                          </div>
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
                        {chat.assignedTo && (statusFilter === 'OPEN' || statusFilter === 'UNASSIGNED') && (
                          <span className="text-[10px] text-on-surface-variant/70 font-medium">
                            → {chat.assignedTo.name.split(' ')[0]}
                          </span>
                        )}
                      </div>
                      {unread > 0 && (
                        <span
                          aria-label={`${unread} sin leer`}
                          className="min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-white text-overline flex items-center justify-center animate-pulse-soft"
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

      <section className={cn('flex-1 flex-col relative min-w-0', mobileShowChat ? 'flex' : 'hidden md:flex')}>
        {activeChat ? (
          <>
            <header className="px-4 md:px-6 py-3 bg-white/80 backdrop-blur-xl border-b border-outline-variant/40 flex justify-between items-center gap-3 z-sticky">
              <div className="flex items-center gap-3 min-w-0">
                <Button
                  variant="icon"
                  size="sm"
                  leadingIcon="arrow_back"
                  className="md:hidden flex-shrink-0 -ml-1"
                  onClick={() => setMobileShowChat(false)}
                  aria-label="Volver"
                />
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white font-semibold shadow-glass-sm flex-shrink-0">
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
                    <Badge variant={activeChat.conversationStatus === 'CLOSED' ? 'neutral' : 'success'} dot />
                    <span className="text-overline text-on-surface-variant uppercase truncate">
                      {activeChat.conversationStatus === 'CLOSED' ? 'Cerrado' : 'Activo'} · {activeChat.phone}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon="psychology_alt"
                  onClick={handleClearAIContext}
                  title="Limpiar contexto de IA"
                >
                  Reset IA
                </Button>
                {activeChat.conversationStatus !== 'CLOSED' ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon="lock"
                    onClick={handleCloseConversation}
                  >
                    Cerrar caso
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon="lock_open"
                    onClick={handleReopenConversation}
                  >
                    Reabrir
                  </Button>
                )}
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
                  onClick={() => isAiCurrentlyPaused ? handleResumeAI() : handlePauseAI(1)}
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

            {activeChat.conversationStatus === 'CLOSED' && (
              <Card
                variant="solid"
                padding="sm"
                className="mx-4 md:mx-6 mt-3 bg-surface-container border-outline-variant/40"
              >
                <div className="flex items-center gap-2">
                  <Icon name="lock" size="sm" className="text-on-surface-variant" />
                  <p className="text-body-sm text-on-surface-variant">
                    Esta conversación está cerrada. Se reabrirá automáticamente si el cliente responde.
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
              ) : (() => {
                const threadItems: ThreadItem[] = [
                  ...messages.map((m) => ({ ...m, _kind: 'message' as const })),
                  ...notes.map((n) => ({ ...n, _kind: 'note' as const })),
                ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                return threadItems.map((item, index) =>
                  item._kind === 'note' ? (
                    <NoteBubble
                      key={item.id}
                      content={item.content}
                      authorName={item.author?.name ?? 'Operador'}
                      time={new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      onDelete={() => handleDeleteNote(item.id)}
                      delay={Math.min(index, 10) * 30}
                    />
                  ) : (
                    <MessageBubble
                      key={item.id}
                      sent={item.direction === 'OUTBOUND'}
                      text={item.content}
                      time={new Date(item.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      isAi={item.direction === 'OUTBOUND'}
                      delay={Math.min(index, 10) * 30}
                    />
                  ),
                );
              })()}
              <div ref={messagesEndRef} />
            </div>

            <footer className="p-4 md:p-5 bg-white border-t border-outline-variant/40">
              <div className="max-w-4xl mx-auto">
                <div className="flex gap-1 mb-2">
                  <button
                    type="button"
                    onClick={() => setNoteMode(false)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-caption font-medium transition-colors',
                      !noteMode ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-low',
                    )}
                  >
                    Mensaje
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteMode(true)}
                    className={cn(
                      'px-3 py-1 rounded-lg text-caption font-medium transition-colors flex items-center gap-1',
                      noteMode ? 'bg-amber-500 text-white' : 'text-on-surface-variant hover:bg-surface-container-low',
                    )}
                  >
                    <Icon name="edit_note" size="xs" />
                    Nota interna
                  </button>
                </div>
                <div className={cn(
                  'flex items-center gap-2 rounded-2xl px-4 py-2 border',
                  noteMode
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-surface-container-low border-outline-variant/40',
                )}>
                  <input
                    type="text"
                    value={noteMode ? newNote : newMessage}
                    onChange={(e) => noteMode ? setNewNote(e.target.value) : setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        noteMode ? handleSendNote() : handleSendMessage();
                      }
                    }}
                    placeholder={noteMode ? 'Nota interna (solo visible para operadores)...' : 'Escribe un mensaje...'}
                    aria-label={noteMode ? 'Escribe una nota interna' : 'Escribe un mensaje'}
                    className={cn(
                      'flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-body py-1',
                      noteMode ? 'text-amber-900 placeholder:text-amber-400' : 'text-on-surface placeholder:text-on-surface-variant/70',
                    )}
                  />
                  <Button
                    variant="primary"
                    size="md"
                    aria-label={noteMode ? 'Guardar nota' : 'Enviar mensaje'}
                    onClick={noteMode ? handleSendNote : handleSendMessage}
                    disabled={noteMode ? !newNote.trim() : !newMessage.trim()}
                    leadingIcon={noteMode ? 'save' : 'send'}
                    className={noteMode ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : ''}
                  >
                    {noteMode ? 'Guardar' : 'Enviar'}
                  </Button>
                </div>
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
            ? 'bg-primary text-white border-primary rounded-tr-sm'
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
            sent ? 'text-white/70' : 'text-on-surface-variant',
          )}
        >
          {time}
          {sent && <Icon name="done_all" size="xs" />}
        </div>
      </div>
    </div>
  </div>
);

interface NoteBubbleProps {
  content: string;
  authorName: string;
  time: string;
  onDelete?: () => void;
  delay: number;
}

const NoteBubble = ({ content, authorName, time, onDelete, delay }: NoteBubbleProps) => (
  <div
    className="flex justify-center animate-fade-in-up"
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className="max-w-[80%] w-full">
      <div className="px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 shadow-glass-sm">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-amber-700">
            <Icon name="edit_note" size="xs" />
            <span className="text-overline font-medium uppercase">Nota interna — {authorName}</span>
          </div>
          {onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-0.5 rounded hover:bg-amber-100 text-amber-500 transition-colors"
              aria-label="Eliminar nota"
            >
              <Icon name="delete" size="xs" />
            </button>
          )}
        </div>
        <p className="text-body text-amber-900 leading-relaxed whitespace-pre-wrap">{content}</p>
        <p className="text-overline text-amber-600 mt-2">{time}</p>
      </div>
    </div>
  </div>
);

export default MessageCenter;
