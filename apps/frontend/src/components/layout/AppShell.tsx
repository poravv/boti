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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <Sidebar user={user} onLogout={onLogout} items={items} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-[var(--sidebar-width)]">
        <Header
          user={user}
          notifications={notifications}
          onClearNotifications={onClearNotifications}
        />
        
        <main className="flex-1 p-4 md:p-8 mt-[var(--header-height)] pb-24 md:pb-8">
          <div className="max-w-[1600px] mx-auto animate-in">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom Nav - Mobile */}
      <BottomNav items={items} />
    </div>
  );
}
