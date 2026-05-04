import { NavLink, Link } from 'react-router-dom';
import { Badge, Icon, cn } from '../ui';

export interface SidebarUser {
  name?: string;
  role?: string;
  unreadTotal?: number;
}

export interface SidebarNavItem {
  name: string;
  path: string;
  icon: string;
  badge?: number;
  section?: string;
  mobileNav?: boolean;
}

export interface SidebarProps {
  user: SidebarUser;
  onLogout: () => void;
  items: SidebarNavItem[];
}

export function Sidebar({ user, onLogout, items }: SidebarProps) {
  return (
    <aside
      aria-label="Primary"
      className="fixed left-0 top-0 bottom-0 hidden md:flex flex-col w-sidebar-width z-sticky bg-[#0B1120] border-r border-white/[0.06]"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/[0.06]">
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-action flex items-center justify-center shadow-lg">
          <img src="/logo.png" alt="Boti" className="w-7 h-7 object-contain brightness-0 invert" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-white text-lg leading-none tracking-tight">Boti</div>
          <div className="text-white/40 text-xs leading-none mt-1 font-medium">Business Suite</div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar" aria-label="Primary">
        {(() => {
          const grouped = items.reduce<{ section?: string; items: SidebarNavItem[] }[]>((acc, item) => {
            const last = acc[acc.length - 1];
            if (last && last.section === item.section) { last.items.push(item); return acc; }
            return [...acc, { section: item.section, items: [item] }];
          }, []);

          return grouped.map((group, gi) => (
            <div key={gi} className="mb-6">
              {group.section && (
                <p className="px-3 mb-2 text-[10px] font-bold text-white/25 uppercase tracking-[0.15em] select-none">
                  {group.section}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.path === '/'}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer',
                        isActive
                          ? 'bg-action/15 text-action'
                          : 'text-white/50 hover:text-white hover:bg-white/[0.07]',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon
                          name={item.icon}
                          size="sm"
                          filled={isActive}
                          className={cn(
                            'transition-colors duration-200',
                            isActive ? 'text-action' : 'text-white/35 group-hover:text-white/80'
                          )}
                        />
                        <span className="flex-1 truncate">{item.name}</span>
                        {(item.badge || 0) > 0 && (
                          <Badge variant="primary" size="sm" className="rounded-md px-1.5 h-5">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ));
        })()}
      </nav>

      {/* User profile */}
      <div className="p-4 border-t border-white/[0.06]">
        <Link
          to="/profile"
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.07] transition-all duration-300 group"
        >
          <div className="w-9 h-9 rounded-full bg-action/20 border border-action/30 flex items-center justify-center text-action text-xs font-bold uppercase flex-shrink-0">
            {(user?.name?.[0] ?? 'A').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-semibold truncate leading-none">
              {user?.name ?? 'Admin'}
            </div>
            <div className="text-white/40 text-[10px] leading-none mt-1 font-medium uppercase tracking-wider">
              {user?.role ?? 'ADMIN'}
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/40 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 mt-1 text-sm font-medium"
        >
          <Icon name="logout" size="sm" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

export interface BottomNavProps {
  items: SidebarNavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  const mobileItems = items.filter((i) => i.mobileNav);
  const visibleItems = (mobileItems.length > 0 ? mobileItems : items).slice(0, 5);

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 h-16 flex justify-around items-center px-4 md:hidden bg-[#0B1120]/95 backdrop-blur-xl border-t border-white/[0.06] z-sticky shadow-[0_-4px_10px_rgba(0,0,0,0.2)]"
    >
      {visibleItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-200',
              isActive ? 'text-action' : 'text-white/40',
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Icon name={item.icon} size="md" filled={isActive} />
                {(item.badge || 0) > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center px-1 border-2 border-[#0B1120]">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className={cn("text-[10px] font-bold uppercase tracking-tighter", isActive ? "opacity-100" : "opacity-0")}>
                {item.name}
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
