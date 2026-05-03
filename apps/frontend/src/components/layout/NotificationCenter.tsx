import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, EmptyState, Icon, cn } from '../ui';

export interface NotificationItem {
  id: number | string;
  title: string;
  desc: string;
  time: string;
  icon: string;
  tone: 'primary' | 'warning' | 'info' | 'success' | 'danger';
}

export interface NotificationCenterProps {
  notifications: NotificationItem[];
  onClear: () => void;
}

const TONE_CLASSES: Record<NotificationItem['tone'], string> = {
  primary: 'bg-primary/10 text-primary',
  warning: 'bg-warning-container text-on-warning-container',
  info: 'bg-info-container text-on-info-container',
  success: 'bg-success-container text-on-success-container',
  danger: 'bg-error-container text-on-error-container',
};

export function NotificationCenter({ notifications, onClear }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const count = notifications.length;

  return (
    <div ref={containerRef} className="relative">
      <Button
        variant="icon"
        size="md"
        aria-label={
          count
            ? `Notificaciones, ${count} ${count === 1 ? 'notificación' : 'notificaciones'} sin leer`
            : 'Notificaciones, sin nuevas alertas'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="relative"
      >
        <Icon name="notifications" size="md" filled={count > 0} aria-hidden="true" />
        {count > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-error border-2 border-white animate-pulse-soft"
          />
        )}
      </Button>

      {open && (
        <Card
          role="dialog"
          aria-label="Notificaciones"
          variant="glass-elevated"
          padding="md"
          className="absolute right-0 mt-2 w-80 z-popover animate-fade-in-down"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-title text-primary">Alertas</h4>
            {count > 0 && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                Limpiar
              </Button>
            )}
          </div>

          {count === 0 ? (
            <EmptyState
              icon="notifications_off"
              title="Sin alertas pendientes"
              description="Las nuevas notificaciones aparecerán aquí."
            />
          ) : (
            <ul
              role="list"
              aria-label="Lista de notificaciones"
              className="space-y-2 max-h-96 overflow-y-auto"
            >
              {notifications.map((notification, index) => (
                <li
                  key={notification.id}
                  role="listitem"
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                >
                  <div className="flex gap-3 p-3 rounded-xl bg-surface-container-low/80 border border-outline-variant/40 hover:border-action/20 transition-colors">
                    <div
                      aria-hidden="true"
                      className={cn(
                        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                        TONE_CLASSES[notification.tone],
                      )}
                    >
                      <Icon name={notification.icon} size="sm" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between items-center gap-2 mb-0.5">
                        <p className="text-body-sm font-semibold text-on-surface truncate">
                          {notification.title}
                        </p>
                        <Badge variant="neutral" size="sm">
                          {notification.time}
                        </Badge>
                      </div>
                      <p className="text-caption text-on-surface-variant leading-snug line-clamp-2">
                        {notification.desc}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
