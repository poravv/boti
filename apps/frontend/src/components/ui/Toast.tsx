import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { Icon } from './Icon';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title?: string;
  message: string;
  duration: number;
}

export interface ToastOptions {
  variant?: ToastVariant;
  title?: string;
  /** Milliseconds until auto-dismiss. Use 0 to keep until manually closed. */
  duration?: number;
}

export interface ToastContextValue {
  show: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 5;

const VARIANT_ICON: Record<ToastVariant, string> = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
  error: 'error',
};

const VARIANT_STYLE: Record<ToastVariant, string> = {
  info: 'border-info/30 text-on-info-container',
  success: 'border-success/30 text-on-success-container',
  warning: 'border-warning/30 text-on-warning-container',
  error: 'border-error/30 text-on-error-container',
};

const VARIANT_ICON_COLOR: Record<ToastVariant, string> = {
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timerId = timers.current.get(id);
    if (timerId) {
      window.clearTimeout(timerId);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback<ToastContextValue['show']>(
    (message, options = {}) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const toast: Toast = {
        id,
        message,
        title: options.title,
        variant: options.variant ?? 'info',
        duration: options.duration ?? 4000,
      };
      setToasts((prev) => {
        const next = [...prev, toast];
        // Drop oldest when stack exceeds MAX_VISIBLE to avoid UI overwhelm.
        return next.length > MAX_VISIBLE ? next.slice(next.length - MAX_VISIBLE) : next;
      });
      if (toast.duration > 0) {
        const timerId = window.setTimeout(() => dismiss(id), toast.duration);
        timers.current.set(id, timerId);
      }
      return id;
    },
    [dismiss],
  );

  const clear = useCallback(() => {
    timers.current.forEach((timerId) => window.clearTimeout(timerId));
    timers.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    const currentTimers = timers.current;
    return () => {
      currentTimers.forEach((timerId) => window.clearTimeout(timerId));
      currentTimers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(() => ({ show, dismiss, clear }), [show, dismiss, clear]);

  const portalTarget = typeof document !== 'undefined' ? document.body : null;

  return (
    <ToastContext.Provider value={value}>
      {children}
      {portalTarget
        ? createPortal(
            <div
              aria-live="polite"
              aria-atomic="true"
              className="pointer-events-none fixed top-4 right-4 z-toast flex w-full max-w-sm flex-col gap-2"
            >
              {toasts.map((toast) => (
                <div
                  key={toast.id}
                  role={toast.variant === 'error' ? 'alert' : 'status'}
                  className={cn(
                    'pointer-events-auto glass-elevated flex items-start gap-3 p-3 pr-2 animate-bounce-in border-l-4',
                    VARIANT_STYLE[toast.variant],
                  )}
                >
                  <Icon
                    name={VARIANT_ICON[toast.variant]}
                    size="md"
                    className={cn('mt-0.5', VARIANT_ICON_COLOR[toast.variant])}
                  />
                  <div className="flex-1 min-w-0">
                    {toast.title ? (
                      <p className="text-body-sm font-semibold text-on-surface">{toast.title}</p>
                    ) : null}
                    <p className="text-body-sm text-on-surface-variant break-words">{toast.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    aria-label="Cerrar notificación"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high/70 transition-colors duration-250 focus-ring"
                  >
                    <Icon name="close" size="sm" />
                  </button>
                </div>
              ))}
            </div>,
            portalTarget,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}
