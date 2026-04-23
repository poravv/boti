import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from './cn';
import { Icon } from './Icon';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: ModalSize;
  /** Hides the default close button in the header. */
  hideCloseButton?: boolean;
  /** Disables closing via backdrop click / Escape. */
  dismissible?: boolean;
  className?: string;
}

const SIZE: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible portal-based modal with focus trap and ESC/backdrop dismissal.
 * Rendered in `document.body` to escape any transformed ancestors.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  hideCloseButton = false,
  dismissible = true,
  className,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Lock body scroll + remember the previously focused element while open.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Move focus into the dialog once it renders.
  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    if (!node) return;
    const firstFocusable = node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? node).focus();
  }, [open]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape' && dismissible) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      // Focus trap: cycle focus within the dialog.
      const node = dialogRef.current;
      if (!node) return;
      const focusables = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.hasAttribute('data-focus-guard'),
      );
      if (focusables.length === 0) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [dismissible, onClose],
  );

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  const content = (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-fade-in-up"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cerrar modal"
        tabIndex={-1}
        onClick={dismissible ? onClose : undefined}
        className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-md cursor-default"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          'relative w-full glass-elevated shadow-glass-xl animate-scale-in focus:outline-none',
          SIZE[size],
          className,
        )}
      >
        {(title || !hideCloseButton) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
            <div className="flex-1 min-w-0">
              {title ? (
                <h2 id="modal-title" className="text-heading-sm text-on-surface">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id="modal-description" className="text-body-sm text-on-surface-variant mt-1">
                  {description}
                </p>
              ) : null}
            </div>
            {!hideCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high/70 transition-colors duration-250 focus-ring"
              >
                <Icon name="close" size="md" />
              </button>
            ) : null}
          </div>
        )}
        <div className="px-6 pb-5">{children}</div>
        {footer ? (
          <div className="px-6 pb-5 pt-3 border-t border-outline-variant/30 flex items-center justify-end gap-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
