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
      style={{ height: 'var(--app-header-h)' }}
      className="fixed top-0 left-0 md:left-64 right-0 z-sticky bg-surface-container-lowest/95 backdrop-blur-xl border-b border-outline-variant/30 flex items-center px-4 md:px-6 gap-4"
    >
      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h1 className="text-on-surface font-semibold text-heading-sm truncate">{title}</h1>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {actions}

        {/* Notifications */}
        <div className="relative">
          <NotificationCenter notifications={notifications} onClear={onClearNotifications} />
        </div>

        {/* Avatar */}
        <button
          type="button"
          aria-label={`Perfil de ${user?.name ?? 'usuario'}`}
          onClick={() => navigate('/profile')}
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary text-caption font-bold uppercase shadow-glass-sm hover:shadow-glass transition-shadow duration-200 focus-ring flex-shrink-0 cursor-pointer"
        >
          {avatarChar}
        </button>
      </div>
    </header>
  );
}
