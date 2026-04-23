import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Icon, Tooltip } from '../ui';
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
  '/': 'System Overview',
  '/connections': 'Connection Management',
  '/messages': 'Message Center',
  '/ai-config': 'AI Engine Tuning',
};

export function Header({ user, notifications, onClearNotifications, actions }: HeaderProps) {
  const location = useLocation();
  const title = ROUTE_TITLES[location.pathname] ?? 'Boti';
  const avatarChar = (user?.name || 'A').slice(0, 1).toUpperCase();

  return (
    <header
      role="banner"
      style={{ height: 'var(--app-header-h)' }}
      className="fixed top-0 left-0 right-0 md:left-64 z-sticky flex items-center justify-between px-4 md:px-6 bg-white/70 backdrop-blur-xl border-b border-outline-variant/40 shadow-glass-sm"
    >
      <div className="flex items-center gap-4 min-w-0">
        <h1 className="text-overline text-primary uppercase truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <Tooltip content="Próximamente">
          <div
            className="hidden sm:flex items-center gap-2 bg-surface-container-low border border-outline-variant/40 rounded-full px-4 h-10 opacity-60 cursor-not-allowed"
            aria-disabled="true"
          >
            <Icon
              name="search"
              size="sm"
              className="text-on-surface-variant"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Buscar logs (próximamente)"
              aria-disabled="true"
              disabled
              placeholder="Búsqueda próximamente..."
              className="bg-transparent border-none focus:ring-0 text-body-sm text-on-surface placeholder:text-on-surface-variant/70 w-48 focus:outline-none cursor-not-allowed"
            />
          </div>
        </Tooltip>
        {actions}
        <NotificationCenter notifications={notifications} onClear={onClearNotifications} />
        <div
          aria-label={`Sesión de ${user?.name || 'Admin'}`}
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary text-caption font-bold uppercase shadow-glass-sm"
        >
          {avatarChar}
        </div>
      </div>
    </header>
  );
}
