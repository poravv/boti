import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { NotificationCenter, type NotificationItem } from './NotificationCenter';

export interface HeaderUser {
  name?: string;
}

export interface HeaderProps {
  user: HeaderUser;
  notifications: NotificationItem[];
  onClearNotifications: () => void;
  actions?: ReactNode;
}

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Panel principal',
  '/connections': 'Conexiones WhatsApp',
  '/messages': 'Centro de mensajes',
  '/ai-config': 'Configuración IA',
  '/profile': 'Mi perfil',
  '/external-apis': 'APIs externas',
};

export function Header({ user, notifications, onClearNotifications, actions }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const title = ROUTE_TITLES[location.pathname] ?? 'Boti';
  const avatarChar = (user?.name || 'A').slice(0, 1).toUpperCase();

  return (
    <header
      role="banner"
      className="fixed top-0 left-0 md:left-[var(--sidebar-width)] right-0 h-[var(--header-height)] z-sticky bg-[#0B1120]/95 backdrop-blur-xl border-b border-white/[0.06] flex items-center px-6 md:px-10 gap-6"
    >
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-white/90 font-bold text-xl tracking-tight truncate">{title}</h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        {actions}

        {/* Notifications */}
        <div className="relative [&_button:first-child]:text-white/60 [&_button:first-child]:hover:text-white [&_button:first-child]:hover:bg-white/[0.07]">
          <NotificationCenter notifications={notifications} onClear={onClearNotifications} />
        </div>

        {/* Profile Shortcut */}
        <button
          type="button"
          aria-label={`Perfil de ${user?.name ?? 'usuario'}`}
          onClick={() => navigate('/profile')}
          className="w-9 h-9 rounded-full bg-action/20 border border-action/30 flex items-center justify-center text-action text-xs font-bold uppercase hover:bg-action/30 transition-all duration-300 focus-ring flex-shrink-0 cursor-pointer"
        >
          {avatarChar}
        </button>
      </div>
    </header>
  );
}
