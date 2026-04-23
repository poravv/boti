import React, { useState, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import MessageCenter from './components/MessageCenter';
import WhatsAppConnections from './components/WhatsAppConnections';
import AIConfiguration from './components/AIConfiguration';
import Login from './components/Login';

const Sidebar = ({ user, onLogout }: { user: any; onLogout: () => void }) => {
  const navItems = [
    { name: 'Dashboard', path: '/', icon: 'dashboard' },
    { name: 'Connections', path: '/connections', icon: 'link' },
    { name: 'Messages', path: '/messages', icon: 'forum', badge: user?.unreadTotal },
    { name: 'AI Config', path: '/ai-config', icon: 'psychology' },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 flex flex-col pt-20 pb-6 bg-white/80 backdrop-blur-lg border-r border-slate-200/50 w-64 z-40 hidden md:flex">
      <div className="px-6 mb-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined font-variation-settings-fill">smart_toy</span>
          </div>
          <div>
            <p className="text-xl font-black text-primary leading-none tracking-tighter uppercase">Boti</p>
            <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-black mt-1">Mission Control</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `group flex items-center gap-3 py-3 px-6 mx-2 rounded-xl transition-all font-sans text-sm font-semibold tracking-wide relative ${
                isActive
                  ? 'bg-primary/5 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-primary'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 w-1 h-6 bg-primary rounded-r-full animate-in slide-in-from-left-2 duration-300"></div>
                )}
                <span className={`material-symbols-outlined transition-transform group-hover:scale-110 ${isActive ? 'font-variation-settings-fill' : ''}`}>
                  {item.icon}
                </span>
                {item.name}
                {((item.badge || 0) > 0) && (
                  <span className="ml-auto w-5 h-5 bg-primary text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-lg shadow-primary/20 animate-in zoom-in duration-300">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto px-4 space-y-4">
        <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant flex items-center gap-3">
           <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white text-xs font-black uppercase">
             {user?.name?.slice(0, 2) || 'AD'}
           </div>
           <div className="flex-1 min-w-0">
             <p className="text-xs font-bold text-primary truncate">{user?.name || 'Admin'}</p>
             <p className="text-[9px] text-on-surface-variant uppercase font-black tracking-tighter">{user?.role || 'OPERATOR'}</p>
           </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full py-3 flex items-center justify-center gap-2 text-[10px] font-black text-error hover:bg-error/5 rounded-xl transition-colors uppercase tracking-widest border border-error/10"
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
};

const NotificationItem = ({ title, desc, time, icon, color }: any) => (
  <div className="flex gap-3 p-3 rounded-2xl bg-surface-container border border-outline-variant hover:border-primary/20 transition-all group animate-in slide-in-from-right-4 duration-300">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
      color === 'primary' ? 'bg-primary/10 text-primary' : 'bg-orange-100 text-orange-600'
    }`}>
      <span className="material-symbols-outlined text-sm">{icon}</span>
    </div>
    <div className="min-w-0 flex-1">
      <div className="flex justify-between items-center mb-0.5">
        <p className="text-[10px] font-black text-primary uppercase truncate">{title}</p>
        <span className="text-[8px] font-bold opacity-40 uppercase">{time}</span>
      </div>
      <p className="text-[9px] text-on-surface-variant leading-tight line-clamp-2">{desc}</p>
    </div>
  </div>
);

const Header = ({ user }: { user: any }) => {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  
  useEffect(() => {
    const playNotificationSound = () => {
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
        audio.volume = 0.5;
        audio.play().catch(() => {}); // Catch prevents errors if user hasn't interacted with DOM yet
      } catch (err) {}
    };

    const handleWSEvent = (e: any) => {
      const { event, data, payload } = e.detail;
      const body = data || payload || e.detail;

      if (event === 'message:new' || event === 'operator:notification') {
        playNotificationSound();
        const newNotif = {
          id: Date.now(),
          title: event === 'message:new' ? 'Nuevo Mensaje' : 'Alerta de Sistema',
          desc: body.content || body.event || 'Nueva actividad detectada',
          time: 'Ahora',
          icon: event === 'message:new' ? 'forum' : 'warning',
          color: event === 'message:new' ? 'primary' : 'orange'
        };
        setNotifications(prev => [newNotif, ...prev].slice(0, 5));
      }
    };

    window.addEventListener('boti:ws-event', handleWSEvent);
    return () => window.removeEventListener('boti:ws-event', handleWSEvent);
  }, []);

  const getTitle = () => {
    switch(location.pathname) {
      case '/': return 'System Overview';
      case '/connections': return 'Connection Management';
      case '/messages': return 'Message Center';
      case '/ai-config': return 'AI Engine Tuning';
      default: return 'Boti';
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 flex justify-between items-center px-6 bg-white/70 backdrop-blur-xl border-b border-outline-variant shadow-sm z-50 ml-0 md:ml-64">
      <div className="flex items-center gap-4">
        <h2 className="text-primary font-black text-xs uppercase tracking-widest opacity-80">{getTitle()}</h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center bg-surface-container rounded-full px-4 py-1.5 gap-2 border border-outline-variant">
          <span className="material-symbols-outlined text-on-surface-variant text-sm">search</span>
          <input className="bg-transparent border-none focus:ring-0 text-xs w-48" placeholder="Search logs..." type="text"/>
        </div>
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 hover:bg-surface-container transition-colors rounded-full relative text-on-surface-variant"
          >
            <span className="material-symbols-outlined">notifications</span>
            {notifications.length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-outline-variant p-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Alerts & Notifications</h4>
                {notifications.length > 0 && (
                  <button onClick={() => setNotifications([])} className="text-[9px] font-black text-primary/40 hover:text-primary uppercase">Clear</button>
                )}
              </div>
              <div className="space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-[10px] text-on-surface-variant text-center py-4 font-bold uppercase tracking-tighter italic">No pending alerts</p>
                ) : (
                  notifications.map((n) => (
                    <NotificationItem key={n.id} {...n} />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-black uppercase shadow-sm">
           {user?.name?.slice(0, 1) || 'A'}
        </div>
      </div>
    </header>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState<any>({ activeLines: 0, totalMessages: 0, totalLeads: 0, messagesToday: 0, leadsTrend: '0%', performance: '0%', hourlyTraffic: [] });
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogModal, setShowLogModal] = useState(false);
  const token = localStorage.getItem('token');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, logsRes] = await Promise.all([
          fetch('/api/stats', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/audit-logs', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        const statsData = await statsRes.json();
        const logsData = await logsRes.json();
        setStats(statsData);
        setLogs(logsData.logs || []);
      } catch (e) {}
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const maxTraffic = Math.max(...(stats.hourlyTraffic || [1]), 10);

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="ACTIVE LINES" value={stats.activeLines} icon="bolt" color="teal" delta="ONLINE" />
        <StatCard title="MESSAGES TODAY" value={stats.messagesToday} icon="forum" color="primary" delta={stats.leadsTrend} />
        <StatCard title="TOTAL LEADS" value={stats.totalLeads} icon="psychology" color="orange" delta="GROWTH" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card rounded-2xl p-8 bg-white/70 backdrop-blur-xl shadow-sm">
           <div className="flex items-center justify-between mb-8">
             <div>
               <h3 className="text-xl font-black text-primary tracking-tight">Real-time Traffic</h3>
               <p className="text-xs text-on-surface-variant font-medium">Messages processed in the last 15 hours</p>
             </div>
           </div>
           <div className="h-64 flex items-end gap-1.5 w-full relative">
              {(stats.hourlyTraffic || [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]).map((count: number, i: number) => (
                <div 
                  key={i} 
                  className="flex-1 bg-primary/10 rounded-t-lg transition-all hover:bg-primary group relative" 
                  style={{ height: `${(count / maxTraffic) * 100}%`, minHeight: '4px' }}
                >
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-primary text-white text-[9px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {count} msg
                  </div>
                </div>
              ))}
           </div>
        </div>

        <div className="glass-card rounded-2xl p-8 bg-white/70 backdrop-blur-xl flex flex-col shadow-sm">
          <h3 className="text-xl font-black text-primary tracking-tight mb-6 uppercase">Recent Activity</h3>
          <div className="space-y-6 flex-1">
             {logs.slice(0, 4).map((log, i) => (
               <ActivityItem 
                 key={i}
                 icon={log.action.includes('PAUSE') ? 'pause_circle' : log.action.includes('SEND') ? 'send' : 'info'} 
                 title={log.action} 
                 desc={typeof log.details === 'string' ? log.details : JSON.stringify(log.details).slice(0, 40) + '...'} 
                 time={new Date(log.createdAt).toLocaleTimeString()} 
                 color={log.action.includes('ERROR') ? 'red' : 'teal'} 
               />
             ))}
             {logs.length === 0 && <p className="text-xs text-on-surface-variant text-center opacity-50 py-10 font-bold uppercase tracking-widest">No recent events</p>}
          </div>
          <button 
            onClick={() => setShowLogModal(true)}
            className="w-full mt-8 py-4 text-[10px] font-black text-primary hover:bg-primary/5 transition-colors border border-outline-variant rounded-2xl uppercase tracking-widest"
          >
            View Audit Log
          </button>
        </div>
      </div>

      {showLogModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
              <header className="px-8 py-6 border-b border-outline-variant flex justify-between items-center bg-surface-container">
                 <h3 className="text-sm font-black text-primary uppercase tracking-widest">System Audit Log</h3>
                 <button onClick={() => setShowLogModal(false)} className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center">
                    <span className="material-symbols-outlined">close</span>
                 </button>
              </header>
              <div className="flex-1 overflow-y-auto p-8">
                 <div className="space-y-4">
                    {logs.map((log, i) => (
                      <div key={i} className="flex gap-4 p-4 rounded-2xl bg-surface-container border border-outline-variant items-start hover:border-primary/20 transition-colors">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center text-primary flex-shrink-0">
                          <span className="material-symbols-outlined text-sm">history</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-xs font-black text-primary uppercase tracking-tighter">{log.action}</p>
                            <span className="text-[9px] font-bold opacity-40 uppercase">{new Date(log.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-[10px] font-medium text-on-surface-variant break-words">{JSON.stringify(log.details)}</p>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon, color, delta }: any) => (
  <div className="glass-card rounded-2xl p-6 relative overflow-hidden group bg-white/70 backdrop-blur-xl shadow-sm">
    <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -mr-8 -mt-8 group-hover:scale-110 transition-transform"></div>
    <div className="flex items-center gap-4 mb-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
        color === 'teal' ? 'bg-emerald-100 text-emerald-600' : color === 'orange' ? 'bg-orange-100 text-orange-600' : 'bg-primary/10 text-primary'
      }`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <span className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest">{title}</span>
    </div>
    <div className="flex items-end justify-between">
      <span className="text-4xl font-black text-primary">{value}</span>
      <div className="text-[10px] font-black px-2 py-1 rounded bg-surface-container text-on-surface-variant">
        {delta}
      </div>
    </div>
  </div>
);

const ActivityItem = ({ icon, title, desc, time, color }: any) => (
  <div className="flex gap-4 group">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
      color === 'teal' ? 'bg-emerald-50 text-emerald-600' : color === 'red' ? 'bg-error/10 text-error' : 'bg-surface-container text-on-surface-variant'
    }`}>
      <span className="material-symbols-outlined text-lg">{icon}</span>
    </div>
    <div className="min-w-0">
      <p className="text-sm font-bold text-primary truncate">{title}</p>
      <p className="text-xs text-on-surface-variant font-medium">{desc}</p>
      <span className="text-[10px] text-on-surface-variant font-black uppercase opacity-40">{time}</span>
    </div>
  </div>
);

const App = () => {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const navigate = useNavigate();

  const fetchUnreadCount = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/messages/unread-count', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUnreadTotal(data.count || 0);
    } catch (err) {}
  };

  // Global WebSocket
  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    
    // In production (Docker), we use the relative /ws path through Nginx
    // In dev, we might need to point directly to 3001 if not using the proxy
    const socketUrl = process.env.NODE_ENV === 'production' 
      ? `${protocol}//${host}/ws` 
      : `${protocol}//localhost:3001/ws`;
      
    const ws = new WebSocket(socketUrl);
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Global WS Event:', data.event);
        if (data.event === 'message:new') fetchUnreadCount();
        window.dispatchEvent(new CustomEvent('boti:ws-event', { detail: data }));
      } catch (e) {}
    };

    const heartbeat = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ event: 'ping' }));
    }, 30000);

    return () => {
      clearInterval(heartbeat);
      ws.close();
    };
  }, [token]);

  useEffect(() => {
    fetchUnreadCount();
    window.addEventListener('boti:fetch-unread', fetchUnreadCount);
    return () => window.removeEventListener('boti:fetch-unread', fetchUnreadCount);
  }, [token]);

  useEffect(() => {
    const checkAuth = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        } else {
          localStorage.removeItem('token');
          setToken(null);
        }
      } catch (err) {
        console.error('Auth check failed:', err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [token]);

  const handleLogin = (newToken: string, userData: any) => {
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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={handleLogin} />} />
        <Route path="*" element={<Navigate to="/login" />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={{ ...user, unreadTotal }} onLogout={handleLogout} />
      <Header user={user} />
      <main className="md:ml-64 pt-24 px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/messages" element={<MessageCenter />} />
            <Route path="/connections" element={<WhatsAppConnections />} />
            <Route path="/ai-config" element={<AIConfiguration />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </div>
      </main>
      
      {/* Mobile Nav */}
      <nav className="fixed bottom-0 left-0 w-full h-16 flex justify-around items-center px-4 md:hidden bg-white/90 backdrop-blur-md border-t border-outline-variant z-50 rounded-t-3xl">
        {['dashboard', 'link', 'forum', 'psychology'].map((icon, i) => (
          <NavLink key={i} to={['/', '/connections', '/messages', '/ai-config'][i]} className={({isActive}) => isActive ? 'text-primary scale-110' : 'text-on-surface-variant'}>
            <span className="material-symbols-outlined text-2xl">{icon}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default App;
