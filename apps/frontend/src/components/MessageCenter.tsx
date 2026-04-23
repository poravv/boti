import React, { useState, useEffect, useRef } from 'react';

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

const MessageCenter = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const token = localStorage.getItem('token');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = async () => {
    try {
      const res = await fetch('/api/chats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setChats(data.chats || []);
      if (data.chats?.length > 0 && !activeChat) {
        setActiveChat(data.chats[0]);
      }
    } catch (err) {}
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err) {}
  };

  const fetchMessages = async (phone: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/messages/${phone}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setMessages((data.messages || []).reverse());
      setTimeout(scrollToBottom, 100);
    } catch (err) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchAgents();
  }, [token]);

  useEffect(() => {
    if (activeChat) {
      fetchMessages(activeChat.phone);
      // Mark as read when opening
      fetch(`/api/messages/${activeChat.phone}/read`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(() => {
        window.dispatchEvent(new CustomEvent('boti:fetch-unread'));
        // Local update to clear badge
        setChats(prev => prev.map(c => c.phone === activeChat.phone ? { ...c, unreadCount: 0 } : c));
      });
    }
  }, [activeChat?.id]);

  // Listen for GLOBAL WS Events from App.tsx
  useEffect(() => {
    const handleWSEvent = (e: any) => {
      const { event, data, payload } = e.detail;
      const body = data || payload || e.detail;
      
      if (event === 'message:new' || event === 'message:status' || event === 'operator:notification') {
        fetchChats();
        
        let phone = body.fromPhone || body.clientPhone || body.remoteJid || body.to;
        if (phone && typeof phone === 'string') {
          phone = phone.split('@')[0].split(':')[0];
          if (activeChat && phone === activeChat.phone) {
            // Append message locally if it's new
            if (event === 'message:new') {
              const incomingMsg: Message = {
                id: body.id || Date.now().toString(),
                content: body.content,
                direction: body.direction || (body.fromPhone ? 'INBOUND' : 'OUTBOUND'),
                type: body.type || 'TEXT',
                createdAt: body.createdAt || new Date().toISOString()
              };
              setMessages(prev => {
                if (prev.some(m => m.id === incomingMsg.id)) return prev;
                return [...prev, incomingMsg];
              });
              setTimeout(scrollToBottom, 100);
              
              // Mark as read immediately
              fetch(`/api/messages/${activeChat.phone}/read`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
              }).then(() => window.dispatchEvent(new CustomEvent('boti:fetch-unread')));
            } else {
              fetchMessages(activeChat.phone);
            }
          }
        }
      }
    };

    window.addEventListener('boti:ws-event', handleWSEvent);
    return () => window.removeEventListener('boti:ws-event', handleWSEvent);
  }, [activeChat?.phone]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !activeChat) return;
    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          lineId: 'prueba',
          to: activeChat.phone,
          content: newMessage,
          type: 'TEXT'
        })
      });
      if (res.ok) {
        setNewMessage('');
        fetchMessages(activeChat.phone);
      }
    } catch (err) {}
  };

  const handlePauseAI = async (hours: number) => {
    if (!activeChat) return;
    try {
      const res = await fetch(`/api/clients/${activeChat.phone}/pause`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ hours })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveChat({ ...activeChat, aiPausedUntil: data.pausedUntil });
      }
    } catch (err) {}
  };

  const handleAssignAgent = async (agentId: string | null) => {
    if (!activeChat) return;
    try {
      const res = await fetch(`/api/clients/${activeChat.phone}/assign`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ agentId })
      });
      if (res.ok) {
        fetchChats();
        const agent = agents.find(a => a.id === agentId);
        setActiveChat({ 
          ...activeChat, 
          assignedTo: agent ? { id: agent.id, name: agent.name, email: '' } : undefined 
        });
      }
    } catch (err) {}
  };

  const isAiCurrentlyPaused = activeChat?.aiPausedUntil && new Date(activeChat.aiPausedUntil) > new Date();

  return (
    <div className="flex h-[calc(100vh-48px)] -m-container-padding overflow-hidden bg-[#F8F9FD]">
      <div className="w-80 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-100">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input type="text" placeholder="Buscar..." className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl border-none focus:ring-2 focus:ring-primary/10 text-xs font-medium" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => setActiveChat(chat)}
              className={`w-full p-4 flex gap-3 hover:bg-slate-50 transition-all border-b border-slate-50 text-left ${activeChat?.id === chat.id ? 'bg-blue-50/50 border-l-4 border-l-primary' : ''}`}
            >
              <div className="w-11 h-11 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-slate-600 font-bold text-sm border-2 border-white shadow-sm">
                {chat.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <p className="text-[13px] font-bold text-slate-800 truncate">{chat.name}</p>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(chat.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate font-medium">{chat.lastMsg}</p>
                {chat.assignedTo && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                    <span className="text-[9px] font-black text-primary/60 uppercase">{chat.assignedTo.name}</span>
                  </div>
                )}
              </div>
              {((chat.unreadCount || 0) > 0) && (
                <div className="flex flex-col items-end justify-center">
                  <div className="w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
                    {chat.unreadCount}
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col relative">
        {activeChat ? (
          <>
            <header className="px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 flex justify-between items-center z-10">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white font-bold shadow-md">
                  {activeChat.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 leading-tight">{activeChat.name}</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Activo • {activeChat.phone}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <select 
                  value={activeChat.assignedTo?.id || ''} 
                  onChange={(e) => handleAssignAgent(e.target.value || null)}
                  className="bg-surface-container border-none text-[10px] font-black uppercase tracking-wider rounded-lg focus:ring-0 text-primary cursor-pointer hover:bg-primary/5 transition-colors"
                >
                  <option value="">Sin Asignar</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>

                <button 
                  onClick={() => handlePauseAI(1)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold transition-all shadow-sm border ${isAiCurrentlyPaused ? 'bg-orange-500 text-white border-orange-500' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  <span className="material-symbols-outlined text-sm">{isAiCurrentlyPaused ? 'play_circle' : 'pause_circle'}</span>
                  {isAiCurrentlyPaused ? 'REANUDAR IA' : 'PAUSAR IA 1H'}
                </button>
              </div>
            </header>

            {isAiCurrentlyPaused && (
              <div className="bg-orange-50/80 backdrop-blur-sm border-b border-orange-100 px-6 py-2 flex items-center justify-between">
                <p className="text-[11px] text-orange-800 font-semibold flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  Chatbot pausado para atención manual hasta {new Date(activeChat.aiPausedUntil!).toLocaleTimeString()}
                </p>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed">
              {messages.map((msg) => (
                <MessageBubble 
                  key={msg.id}
                  type={msg.direction === 'INBOUND' ? 'received' : 'sent'} 
                  text={msg.content} 
                  time={new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  isAi={msg.direction === 'OUTBOUND'}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            <footer className="p-6 bg-white border-t border-slate-200">
              <div className="max-w-4xl mx-auto flex items-center gap-3 bg-slate-50 rounded-2xl p-2 pl-5 pr-2 border border-slate-200 shadow-inner">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Escribe un mensaje aquí..."
                  className="flex-1 bg-transparent border-none focus:ring-0 text-[13px] py-2 placeholder:text-slate-400 font-medium"
                />
                <button onClick={handleSendMessage} className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
                  <span className="material-symbols-outlined text-lg">send</span>
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-4xl">chat_bubble</span>
            </div>
            <p className="text-sm font-semibold text-slate-400">Selecciona una conversación</p>
          </div>
        )}
      </div>
    </div>
  );
};

const MessageBubble = ({ type, text, time, isAi }: any) => (
  <div className={`flex ${type === 'sent' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
    <div className="max-w-[80%] relative group">
      <div className={`px-4 py-3 rounded-2xl shadow-sm border ${type === 'sent' ? 'bg-primary border-primary text-white rounded-tr-none' : 'bg-white border-slate-200 text-slate-800 rounded-tl-none'}`}>
        {isAi && (
          <div className="flex items-center gap-1.5 mb-1.5 opacity-80">
            <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Inteligencia Artificial</span>
          </div>
        )}
        <p className="text-[13px] leading-relaxed font-medium whitespace-pre-wrap">{text}</p>
        <div className={`text-[9px] mt-2 flex items-center justify-end gap-1 font-bold ${type === 'sent' ? 'text-white/60' : 'text-slate-400'}`}>
          {time}
          {type === 'sent' && <span className="material-symbols-outlined text-[10px]">done_all</span>}
        </div>
      </div>
    </div>
  </div>
);

export default MessageCenter;
