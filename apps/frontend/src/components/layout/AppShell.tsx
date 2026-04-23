import type { ReactNode } from 'react';
import { Header, type HeaderUser } from './Header';
import { BottomNav, Sidebar, type SidebarNavItem, type SidebarUser } from './Sidebar';
import type { NotificationItem } from './NotificationCenter';

export interface AppShellProps {
  user: SidebarUser & HeaderUser;
  onLogout: () => void;
  items: SidebarNavItem[];
  notifications: NotificationItem[];
  onClearNotifications: () => void;
  children: ReactNode;
}

export function AppShell({
  user,
  onLogout,
  items,
  notifications,
  onClearNotifications,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar user={user} onLogout={onLogout} items={items} />
      <Header
        user={user}
        notifications={notifications}
        onClearNotifications={onClearNotifications}
      />
      <main
        style={{ paddingTop: 'calc(var(--app-header-h) + 2rem)' }}
        className="md:ml-64 px-4 md:px-6 pb-24 md:pb-12"
      >
        <div className="max-w-7xl mx-auto">{children}</div>
      </main>
      <BottomNav items={items} />
    </div>
  );
}
