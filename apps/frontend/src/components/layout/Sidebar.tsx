import { NavLink, Link } from 'react-router-dom';
import { Badge, Button, Icon, cn } from '../ui';

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
}

export interface SidebarProps {
  user: SidebarUser;
  onLogout: () => void;
  items: SidebarNavItem[];
}

export function Sidebar({ user, onLogout, items }: SidebarProps) {
  const initials = (user?.name || 'AD').slice(0, 2).toUpperCase();

  return (
    <aside
      aria-label="Primary"
      style={{ paddingTop: 'calc(var(--app-header-h) + 1rem)' }}
      className="fixed left-0 top-0 bottom-0 hidden md:flex flex-col pb-6 w-64 z-sticky bg-white/80 backdrop-blur-xl border-r border-outline-variant/40"
    >
      <div className="px-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-on-primary shadow-glass">
            <Icon name="smart_toy" size="md" filled />
          </div>
          <div>
            <p className="text-heading-sm text-primary leading-none tracking-tight uppercase">Boti</p>
            <p className="text-overline text-on-surface-variant mt-1 uppercase">Mission Control</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-2" aria-label="Primary">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-250 ease-premium text-body font-semibold focus-ring',
                isActive
                  ? 'bg-primary/5 text-primary'
                  : 'text-on-surface-variant hover:bg-surface-container hover:text-primary',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full"
                  />
                )}
                <Icon
                  name={item.icon}
                  size="md"
                  filled={isActive}
                  className="transition-transform duration-250 ease-premium group-hover:scale-110"
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
      </nav>

      <div className="mt-auto px-4 space-y-3">
        <Link
          to="/profile"
          className="p-3 bg-surface-container rounded-2xl border border-outline-variant/40 flex items-center gap-3 hover:bg-surface-container-high transition-colors focus-ring"
          aria-label="Ver perfil de usuario"
        >
          <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-on-secondary text-caption font-bold uppercase">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-sm font-semibold text-primary truncate">
              {user?.name || 'Admin'}
            </p>
            <p className="text-overline text-on-surface-variant uppercase">
              {user?.role || 'OPERATOR'}
            </p>
          </div>
          <Icon name="chevron_right" size="sm" className="text-on-surface-variant" />
        </Link>
        <Button
          variant="ghost"
          size="sm"
          fullWidth
          leadingIcon="logout"
          onClick={onLogout}
          className="text-error hover:bg-error/5"
        >
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

export interface BottomNavProps {
  items: SidebarNavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 h-16 flex justify-around items-center px-2 md:hidden bg-white/90 backdrop-blur-xl border-t border-outline-variant/40 z-sticky rounded-t-3xl"
    >
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          aria-label={item.name}
          className={({ isActive }) =>
            cn(
              'relative flex flex-col items-center justify-center h-12 w-12 rounded-xl transition-colors focus-ring',
              isActive ? 'text-primary' : 'text-on-surface-variant',
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon name={item.icon} size="lg" filled={isActive} />
              {(item.badge || 0) > 0 && (
                <span
                  aria-label={`${item.badge} sin leer`}
                  className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-primary text-on-primary text-overline rounded-full flex items-center justify-center border-2 border-white"
                >
                  {item.badge}
                </span>
              )}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
