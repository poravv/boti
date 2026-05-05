// build: 2026-04-28
import { useCallback, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import MessageCenter from './components/MessageCenter';
import WhatsAppConnections from './components/WhatsAppConnections';
import AIConfiguration from './components/AIConfiguration';
import Login from './components/Login';
import { Dashboard } from './components/pages/Dashboard';
import { ProfilePage } from './components/pages/ProfilePage';
import { AppShell } from './components/layout';
import type { NotificationItem, SidebarNavItem } from './components/layout';
import { apiFetchJson } from './lib/apiClient';
import { firebaseSignOut } from './lib/firebase';
import { ExternalApisPage } from './components/pages/ExternalApisPage';
import { TeamPage } from './components/pages/TeamPage';
import { AutonomousSalesPage } from './components/pages/AutonomousSalesPage';
import { CalendarPage } from './components/pages/CalendarPage';
import { SuperAdminPage } from './components/pages/SuperAdminPage';
import { LandingPage } from './components/pages/LandingPage';
import { ContactsPage } from './components/pages/ContactsPage';
import { HelpPage } from './components/pages/HelpPage';
import { PaymentSimulatorPage } from './components/pages/PaymentSimulatorPage';

interface AuthUser {
  userId?: string;
  name?: string;
  role?: string;
  email?: string;
  orgId?: string;
}

interface WSEventDetail {
  event: string;
  data?: Record<string, unknown>;
  payload?: Record<string, unknown>;
}

const NOTIFICATION_SOUND_URL = '/sounds/notification.mp3';
export const SOUND_PREF_KEY = 'boti:sound-enabled';

const playNotificationSound = () => {
  if (localStorage.getItem(SOUND_PREF_KEY) === 'false') return;
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
  const location = useLocation();

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

    // Normalize WS URL — always ensure the /ws path is present.
    // If VITE_WS_URL is set without the path (e.g. wss://host instead of wss://host/ws),
    // the K8s ingress routes the connection to the frontend container instead of the
    // backend, causing an infinite reconnect loop.
    const rawWsUrl = (import.meta.env.VITE_WS_URL as string | undefined)
      ?? (window.location.protocol === 'https:'
        ? `wss://${window.location.host}`
        : `ws://${window.location.hostname || 'localhost'}:3001`);
    const socketUrl = rawWsUrl.replace(/\/ws\/?$/, '') + '/ws';

    let ws: WebSocket | null = null;
    let closedByEffect = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let reconnectAttempt = 0;

    const clearHeartbeat = () => {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
    };

    const scheduleReconnect = () => {
      if (closedByEffect) return;
      clearHeartbeat();
      const delay = Math.min(1000 * 2 ** reconnectAttempt, 15000);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };

    const connect = () => {
      ws = new WebSocket(socketUrl);

      ws.onopen = () => {
        reconnectAttempt = 0;
        window.dispatchEvent(new CustomEvent('boti:ws-status', { detail: { status: 'CONNECTED' } }));
        clearHeartbeat();
        heartbeat = setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'ping' }));
        }, 25000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.event === 'pong') return;
          if (data.event === 'message:new') fetchUnreadCount();
          window.dispatchEvent(new CustomEvent('boti:ws-event', { detail: data }));
        } catch {
          // Ignore malformed WS payloads.
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        window.dispatchEvent(new CustomEvent('boti:ws-status', { detail: { status: 'DISCONNECTED' } }));
        scheduleReconnect();
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      clearHeartbeat();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
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
        // auth:unauthorized handles actual 401 — don't log out on transient network errors
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
    navigate('/dashboard');
  };

  const handleLogout = () => {
    firebaseSignOut().catch(() => {});
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
        <div className="w-12 h-12 border-4 border-action/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/pay/:saleId" element={<PaymentSimulatorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  // Public routes accessible even when authenticated — render without AppShell
  if (location.pathname === '/' || location.pathname === '/login' || location.pathname.startsWith('/pay/')) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="/pay/:saleId" element={<PaymentSimulatorPage />} />
      </Routes>
    );
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN';
  const isSuperAdmin = user?.role === 'SUPERADMIN';

  const navItems: SidebarNavItem[] = [
    { name: 'Dashboard',   path: '/dashboard',     icon: 'space_dashboard',        mobileNav: true },
    { name: 'Mensajes',    path: '/messages',       icon: 'chat_bubble', badge: unreadTotal, section: 'Conversaciones', mobileNav: true },
    { name: 'Contactos',   path: '/contacts',       icon: 'contact_page',           section: 'Conversaciones' },
    ...(isAdmin ? [
      { name: 'Conexiones', path: '/connections',   icon: 'hub',                    section: 'Configuración', mobileNav: true },
      { name: 'IA',         path: '/ai-config',     icon: 'model_training',         section: 'Configuración' },
      { name: 'APIs',       path: '/external-apis', icon: 'integration_instructions', section: 'Configuración' },
      { name: 'Ventas',     path: '/sales',         icon: 'point_of_sale',          section: 'Configuración' },
      { name: 'Calendario', path: '/calendar',      icon: 'event_note',             section: 'Configuración' },
      { name: 'Equipo',     path: '/settings/team', icon: 'badge',                  section: 'Cuenta' },
    ] as SidebarNavItem[] : []),
    { name: 'Perfil',      path: '/profile',        icon: 'person',                 section: 'Cuenta', mobileNav: true },
    { name: 'Ayuda',       path: '/help',           icon: 'support_agent',          section: 'Cuenta' },
    ...(isSuperAdmin ? [{ name: 'Super Admin', path: '/super-admin', icon: 'shield_person', section: 'Admin' }] as SidebarNavItem[] : []),
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
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/messages" element={<MessageCenter />} />
        <Route path="/connections" element={<WhatsAppConnections />} />
        <Route path="/ai-config" element={<AIConfiguration />} />
        <Route path="/profile" element={<ProfilePage user={user ?? {}} />} />
        <Route path="/external-apis" element={<ExternalApisPage />} />
        <Route path="/sales" element={<AutonomousSalesPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/settings/team" element={<TeamPage currentUserId={user?.userId} />} />
        <Route path="/contacts" element={<ContactsPage />} />
        <Route path="/help" element={<HelpPage />} />
        {isSuperAdmin && <Route path="/super-admin" element={<SuperAdminPage />} />}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppShell>
  );
};

export default App;
