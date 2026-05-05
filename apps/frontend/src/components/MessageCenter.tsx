import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, apiFetchJson } from '../lib/apiClient';
import { useToast } from './ui';
import { ChatList } from './chat/ChatList';
import { ChatWindow } from './chat/ChatWindow';
import { ChatInput } from './chat/ChatInput';
import { ChatInfo } from './chat/ChatInfo';
import { cn } from './ui/cn';

interface Chat {
  id: string;
  name: string;
  phone: string;
  avatarUrl?: string | null;
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

const mergeChatUpdate = (prev: Chat[], incoming: Partial<Chat> & { phone: string }) => {
  const now = new Date().toISOString();
  let found = false;
  const next = prev.map((chat) => {
    if (chat.phone !== incoming.phone) return chat;
    found = true;
    return {
      ...chat,
      ...incoming,
      unreadCount: incoming.unreadCount ?? chat.unreadCount,
      time: incoming.time ?? chat.time ?? now,
    };
  });

  if (!found) {
    next.unshift({
      id: incoming.id ?? incoming.phone,
      name: incoming.name ?? incoming.phone,
      phone: incoming.phone,
      avatarUrl: incoming.avatarUrl ?? null,
      lastMsg: incoming.lastMsg ?? '',
      time: incoming.time ?? now,
      status: incoming.status ?? 'ACTIVE',
      unreadCount: incoming.unreadCount ?? 0,
      lineId: incoming.lineId,
      conversationStatus: incoming.conversationStatus ?? 'OPEN',
    });
  }

  return next.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
};

const MessageCenter = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'CLOSED' | 'UNASSIGNED'>('OPEN');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  
  const activeChatRef = useRef<Chat | null>(null);
  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  const fetchChats = useCallback(async () => {
    try {
      const data = await apiFetchJson<{ chats: Chat[] }>(`/api/chats?status=${statusFilter === 'UNASSIGNED' ? 'OPEN' : statusFilter}`);
      setChats(data.chats || []);
    } catch {
      // Silent
    } finally {
      setLoadingChats(false);
    }
  }, [statusFilter]);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await apiFetchJson<{ agents: Agent[] }>('/api/agents');
      setAgents(data.agents || []);
    } catch { /* ... */ }
  }, []);

  const fetchMessages = useCallback(async (phone: string) => {
    setLoadingMessages(true);
    try {
      const data = await apiFetchJson<{ messages: Message[] }>(`/api/messages/${phone}?limit=50`);
      setMessages(data.messages || []);
    } catch { /* ... */ } finally {
      setLoadingMessages(false);
    }
  }, []);

  const fetchNotes = useCallback(async (phone: string) => {
    try {
      const data = await apiFetchJson<{ notes: InternalNote[] }>(`/api/clients/${phone}/notes`);
      setNotes(data.notes || []);
    } catch { /* ... */ }
  }, []);

  useEffect(() => {
    fetchChats();
    fetchAgents();
  }, [fetchChats, fetchAgents]);

  useEffect(() => {
    if (!activeChat) return;
    fetchMessages(activeChat.phone);
    fetchNotes(activeChat.phone);
    apiFetch(`/api/messages/${activeChat.phone}/read`, { method: 'POST' }).then(() => {
       setChats(prev => prev.map(c => c.phone === activeChat.phone ? { ...c, unreadCount: 0 } : c));
       window.dispatchEvent(new CustomEvent('boti:fetch-unread'));
    });
  }, [activeChat?.id, fetchMessages, fetchNotes]);

  // Light chat-list poll every 30s — catches new conversations and unread counts if a
  // WS event was missed during a brief reconnect window. Much lighter than per-message polling.
  useEffect(() => {
    const interval = setInterval(fetchChats, 30000);
    return () => clearInterval(interval);
  }, [fetchChats]);

  // WebSocket Integration
  useEffect(() => {
    const handleWSEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (!detail) return;
      const body = (detail.data || detail.payload || {});

      if (detail.event === 'message:new') {
        // Extract phone from the richest available field
        const rawPhone = (body.chat?.phone || body.fromPhone || body.clientPhone || '').split('@')[0];
        if (!rawPhone) return;

        // Update chat list — use full chat object from WS (includes avatarUrl, name, etc.)
        if (body.chat?.phone) {
          const chatPhone = body.chat.phone.split('@')[0];
          setChats(prev => mergeChatUpdate(prev, { ...body.chat, phone: chatPhone }));
        } else {
          setChats(prev => mergeChatUpdate(prev, {
            phone: rawPhone,
            lastMsg: body.content ?? '',
            time: new Date().toISOString(),
          }));
        }

        // If this chat is currently open, append message directly (instant, no HTTP round-trip)
        if (activeChatRef.current?.phone === rawPhone) {
          if (body.message?.id) {
            setMessages(prev => {
              // Replace optimistic entry (operator send) with the real DB record
              if (body.message.direction === 'OUTBOUND') {
                const optimisticIdx = prev.findLastIndex(
                  m => m.id.startsWith('optimistic-') && m.content === body.message.content
                );
                if (optimisticIdx >= 0) {
                  const next = [...prev];
                  next[optimisticIdx] = body.message as Message;
                  return next;
                }
              }
              if (prev.some(m => m.id === body.message.id)) return prev;
              return [...prev, body.message as Message];
            });
          } else {
            // Fallback for payloads without full message object
            fetchMessages(rawPhone);
          }
        }
      }

      if (detail.event === 'note:new') {
        const note = body.note;
        if (note && activeChatRef.current?.phone === note.clientPhone) {
          setNotes(prev => [...prev, note]);
        }
      }
    };

    window.addEventListener('boti:ws-event', handleWSEvent);
    return () => window.removeEventListener('boti:ws-event', handleWSEvent);
  }, [fetchMessages]);

  const handleSendMessage = async (content: string) => {
    if (!activeChat) return;
    // Optimistic append — shows message instantly before HTTP round-trip completes
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      content,
      direction: 'OUTBOUND',
      type: 'TEXT',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      await apiFetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineId: activeChat.lineId,
          to: activeChat.phone,
          content,
          type: 'TEXT',
        }),
      });
      // Replace optimistic entry with real DB record (polling will catch it within 4s)
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    } catch {
      // On failure remove optimistic message
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
    }
  };

  const handleSendNote = async (content: string) => {
    if (!activeChat) return;
    try {
      const data = await apiFetchJson<{ note: InternalNote }>(`/api/clients/${activeChat.phone}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      setNotes(prev => [...prev, data.note]);
    } catch { /* ... */ }
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
      const agent = agents.find(a => a.id === agentId);
      setActiveChat({ ...activeChat, assignedTo: agent ? { id: agent.id, name: agent.name, email: '' } : undefined });
    } catch { /* ... */ }
  };

  const filteredChats = chats.filter(c => 
    (statusFilter === 'UNASSIGNED' ? !c.assignedTo : true) &&
    (c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm))
  );

  return (
    <div className="flex h-[calc(100vh-6rem)] -mx-6 -mb-6 bg-white border border-border shadow-premium rounded-2xl overflow-hidden animate-in">
      <ChatList 
        chats={filteredChats}
        activeChatId={activeChat?.id}
        loading={loadingChats}
        onSelectChat={(c) => { setActiveChat(c); setMobileShowChat(true); }}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      <main className={cn(
        "flex-1 flex flex-col min-w-0 bg-[#f8fafc]",
        mobileShowChat ? "flex" : "hidden md:flex"
      )}>
        <ChatWindow 
          chat={activeChat}
          messages={messages}
          notes={notes}
          loading={loadingMessages}
          onCloseChat={() => setMobileShowChat(false)}
          onPauseAI={(h) => apiFetch(`/api/clients/${activeChat?.phone}/pause`, { method: 'POST', body: JSON.stringify({ hours: h }), headers: {'Content-Type': 'application/json'} }).then(() => fetchChats())}
          onResumeAI={() => apiFetch(`/api/clients/${activeChat?.phone}/unpause`, { method: 'POST' }).then(() => fetchChats())}
          onCloseConversation={() => apiFetch(`/api/clients/${activeChat?.phone}/close`, { method: 'POST' }).then(() => fetchChats())}
          onReopenConversation={() => apiFetch(`/api/clients/${activeChat?.phone}/reopen`, { method: 'POST' }).then(() => fetchChats())}
          onClearAI={() => activeChat?.lineId && apiFetch(`/api/lines/${activeChat.lineId}/context/${activeChat.phone}`, { method: 'DELETE' })}
          onDeleteNote={(id) => apiFetch(`/api/clients/${activeChat?.phone}/notes/${id}`, { method: 'DELETE' }).then(() => setNotes(prev => prev.filter(n => n.id !== id)))}
        />
        
        {activeChat && (
          <ChatInput 
            onSendMessage={handleSendMessage}
            onSendNote={handleSendNote}
            disabled={activeChat.conversationStatus === 'CLOSED'}
          />
        )}
      </main>

      {activeChat && (
        <ChatInfo 
          chat={activeChat}
          agents={agents}
          onAssign={handleAssignAgent}
        />
      )}
    </div>
  );
};

export default MessageCenter;
