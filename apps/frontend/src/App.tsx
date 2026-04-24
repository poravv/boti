import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import MessageCenter from './components/MessageCenter';
import WhatsAppConnections from './components/WhatsAppConnections';
import AIConfiguration from './components/AIConfiguration';
import Login from './components/Login';
import { Dashboard } from './components/pages/Dashboard';
import { ProfilePage } from './components/pages/ProfilePage';
import { AppShell } from './components/layout';
import type { NotificationItem, SidebarNavItem } from './components/layout';
import { apiFetchJson } from './lib/apiClient';
import { ExternalApisPage } from './components/pages/ExternalApisPage';
import { TeamPage } from './components/pages/TeamPage';

interface AuthUser {
  userId?: string;
  name?: string;
  role?: string;
  email?: string;
}

interface WSEventDetail {
  event: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

const NOTIFICATION_SOUND_URL = '/sounds/notification.mp3';

const playNotificationSound = () => {
  try {
    const audio = new Audio(NOTIFICATION_SOUND_URL);
    audio.volume = 0.5;
    // Autoplay policy, missing asset, or decode errors must never bubble up.
    audio.play().catch(() => {});
  } catch {
    // Silent fallback: notifications still render visually.
  }
};

const App = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const navigate = useNavigate();

  const fetchUnreadCount = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiFetchJson<{ count: number }>('/api/messages/unread-count');
      setUnreadTotal(data.count || 0);
    } catch {
      // Network errors are non-fatal for unread polling.
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const socketUrl = import.meta.env.VITE_WS_URL
      ?? (window.location.protocol === 'https:'
        ? `wss://${window.location.host}/ws`
        : 'ws://localhost:3001/ws');

    const ws = new WebSocket(socketUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'message:new') fetchUnreadCount();
        window.dispatchEvent(new CustomEvent('boti:ws-event', { detail: data }));
      } catch {
        // Ignore malformed WS payloads.
      }
    };

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'ping' }));
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      ws.close();
    };
  }, [token, fetchUnreadCount]);

  useEffect(() => {
    fetchUnreadCount();
    window.addEventListener('boti:fetch-unread', fetchUnreadCount);
    return () => window.removeEventListener('boti:fetch-unread', fetchUnreadCount);
  }, [fetchUnreadCount]);

  useEffect(() => {
    const handleWSEvent = (event: Event) => {
      const detail = (event as CustomEvent<WSEventDetail>).detail;
      if (!detail) return;
      const body = detail.data || detail.payload || {};
      if (detail.event === 'message:new' || detail.event === 'operator:notification') {
        playNotificationSound();
        const isMessage = detail.event === 'message:new';
        const content = (body as { content?: string; event?: string }).content;
        const fallback = (body as { event?: string }).event;
        const newNotif: NotificationItem = {
          id: Date.now(),
          title: isMessage ? 'Nuevo Mensaje' : 'Alerta de Sistema',
          desc: content || fallback || 'Nueva actividad detectada',
          time: 'Ahora',
          icon: isMessage ? 'forum' : 'warning',
          tone: isMessage ? 'primary' : 'warning',
        };
        setNotifications((prev) => [newNotif, ...prev].slice(0, 5));
      }
    };

    window.addEventListener('boti:ws-event', handleWSEvent);
    return () => window.removeEventListener('boti:ws-event', handleWSEvent);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const userData = await apiFetchJson<any>('/api/auth/me');
        setUser(userData);
      } catch {
        localStorage.removeItem('token');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [token]);

  const handleLogin = (newToken: string, userData: AuthUser) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    navigate('/');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  useEffect(() => {
    const onUnauthorized = () => handleLogout();
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, []);

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Cargando aplicación"
        className="min-h-screen flex items-center justify-center bg-background"
      >
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isAdmin = user?.role === 'ADMIN';

  const navItems: SidebarNavItem[] = [
    { name: 'Dashboard', path: '/', icon: 'dashboard' },
    ...(isAdmin ? [{ name: 'Connections', path: '/connections', icon: 'link' }] : []),
    { name: 'Messages', path: '/messages', icon: 'forum', badge: unreadTotal },
    ...(isAdmin ? [{ name: 'AI Config', path: '/ai-config', icon: 'psychology' }] : []),
    ...(isAdmin ? [{ name: 'APIs', path: '/external-apis', icon: 'api' }] : []),
    ...(isAdmin ? [{ name: 'Equipo', path: '/settings/team', icon: 'group' }] : []),
    { name: 'Perfil', path: '/profile', icon: 'account_circle' },
  ];

  return (
    <AppShell
      user={{ ...user, unreadTotal }}
      onLogout={handleLogout}
      items={navItems}
      notifications={notifications}
      onClearNotifications={() => setNotifications([])}
    >
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/messages" element={<MessageCenter />} />
        <Route path="/connections" element={<WhatsAppConnections />} />
        <Route path="/ai-config" element={<AIConfiguration />} />
        <Route path="/profile" element={<ProfilePage user={user ?? {}} />} />
        <Route path="/external-apis" element={<ExternalApisPage />} />
        <Route path="/settings/team" element={<TeamPage currentUserId={user?.userId} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
};

export default App;
