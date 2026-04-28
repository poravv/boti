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
      className="fixed left-0 top-0 bottom-0 hidden md:flex flex-col w-64 z-sticky bg-gradient-to-b from-surface-container-lowest to-surface-container-low backdrop-blur-xl border-r border-outline-variant/30"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-outline-variant/30 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 shadow-glass-sm bg-white">
          <img src="/logo.png" alt="Boti" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-on-surface text-title leading-none tracking-tight">Boti</div>
          <div className="text-on-surface-variant/60 text-caption leading-none mt-0.5">Business Platform</div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="Primary">
        {(() => {
          const grouped = items.reduce<{ section?: string; items: SidebarNavItem[] }[]>((acc, item) => {
            const last = acc[acc.length - 1];
            if (last && last.section === item.section) { last.items.push(item); return acc; }
            return [...acc, { section: item.section, items: [item] }];
          }, []);

          return grouped.map((group, gi) => (
            <div key={gi} className="mb-1">
              {group.section && (
                <p className="px-3 pt-4 pb-1 text-overline font-semibold text-on-surface-variant/40 uppercase tracking-widest select-none text-[10px]">
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
                        'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-body transition-all duration-200 focus-ring',
                        isActive
                          ? 'bg-primary/8 text-primary font-semibold'
                          : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary"
                          />
                        )}
                        <Icon
                          name={item.icon}
                          size="sm"
                          filled={isActive}
                          className={isActive ? 'text-primary' : 'text-on-surface-variant group-hover:text-on-surface'}
                        />
                        <span className="flex-1 truncate">{item.name}</span>
                        {(item.badge || 0) > 0 && (
                          <Badge variant="primary" size="sm" aria-label={`${item.badge} sin leer`}>
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
      <div className="px-3 py-3 border-t border-outline-variant/30 flex-shrink-0">
        <Link
          to="/profile"
          aria-label="Ver perfil de usuario"
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container transition-colors duration-200 group focus-ring"
        >
          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-on-secondary text-caption font-bold uppercase flex-shrink-0">
            {(user?.name?.[0] ?? 'A').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-on-surface text-body font-medium truncate leading-none">
              {user?.name ?? 'Admin'}
            </div>
            <div className="text-on-surface-variant/60 text-caption leading-none mt-0.5 capitalize">
              {user?.role?.toLowerCase() ?? 'admin'}
            </div>
          </div>
          <Icon
            name="chevron_right"
            size="sm"
            className="text-on-surface-variant/40 group-hover:text-on-surface-variant transition-colors"
          />
        </Link>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-error/5 hover:text-error text-on-surface-variant transition-colors duration-200 mt-0.5 text-body focus-ring"
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
      className="fixed bottom-0 left-0 right-0 h-16 flex justify-around items-center px-2 md:hidden bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline-variant/20 z-sticky"
    >
      {visibleItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          aria-label={item.name}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-0.5 flex-1 py-2 transition-colors duration-200 relative focus-ring rounded-lg',
              isActive ? 'text-primary' : 'text-on-surface-variant',
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className="relative">
                <Icon name={item.icon} size="md" filled={isActive} />
                {(item.badge || 0) > 0 && (
                  <span
                    aria-label={`${item.badge} sin leer`}
                    className="absolute -top-1 -right-1.5 min-w-[16px] h-4 bg-error text-on-error text-[10px] font-bold rounded-full flex items-center justify-center px-1"
                  >
                    {(item.badge ?? 0) > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              {isActive && (
                <span className="text-[10px] font-semibold leading-none">{item.name}</span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
