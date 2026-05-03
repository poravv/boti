import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from './cn';
import { Icon } from './Icon';

export type FieldStatus = 'default' | 'error' | 'success';

type BaseFieldProps = {
  label?: string;
  helperText?: string;
  status?: FieldStatus;
  leadingIcon?: string;
  trailingIcon?: string;
  /** Renders the label as a floating label inside the field. */
  floatingLabel?: boolean;
  containerClassName?: string;
};

const FIELD_BASE =
  'peer w-full bg-white/70 backdrop-blur-xl border rounded-xl text-body text-on-surface placeholder:text-on-surface-variant/70 transition-all duration-250 ease-premium focus-ring disabled:opacity-60 disabled:cursor-not-allowed';

const STATUS_BORDER: Record<FieldStatus, string> = {
  default: 'border-outline-variant/60 hover:border-action/40 focus:border-action',
  error: 'border-error/70 focus:border-error',
  success: 'border-success/70 focus:border-success',
};

const HELPER_COLOR: Record<FieldStatus, string> = {
  default: 'text-on-surface-variant',
  error: 'text-error',
  success: 'text-success',
};

export interface FormInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'>,
    BaseFieldProps {}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(function FormInput(
  {
    id,
    label,
    helperText,
    status = 'default',
    leadingIcon,
    trailingIcon,
    floatingLabel = false,
    className,
    containerClassName,
    placeholder,
    disabled,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const helperId = helperText ? `${inputId}-help` : undefined;
  const useFloating = floatingLabel && !!label;

  return (
    <div className={cn('flex flex-col gap-1', containerClassName)}>
      {label && !useFloating ? (
        <label htmlFor={inputId} className="text-caption text-on-surface-variant">
          {label}
        </label>
      ) : null}
      <div className={cn('relative flex items-center', useFloating && 'mt-2')}>
        {leadingIcon ? (
          <Icon
            name={leadingIcon}
            size="sm"
            className="absolute left-3 text-on-surface-variant pointer-events-none"
          />
        ) : null}
        <input
          ref={ref}
          id={inputId}
          disabled={disabled}
          aria-invalid={status === 'error' || undefined}
          aria-describedby={helperId}
          placeholder={useFloating ? ' ' : placeholder}
          className={cn(
            FIELD_BASE,
            STATUS_BORDER[status],
            'h-11',
            leadingIcon ? 'pl-10' : 'pl-4',
            trailingIcon ? 'pr-10' : 'pr-4',
            useFloating && 'pt-4 pb-1',
            className,
          )}
          {...rest}
        />
        {useFloating ? (
          <label
            htmlFor={inputId}
            className={cn(
              'absolute pointer-events-none text-on-surface-variant transition-all duration-250 ease-premium',
              leadingIcon ? 'left-10' : 'left-4',
              'top-1/2 -translate-y-1/2 text-body',
              'peer-focus:top-1.5 peer-focus:translate-y-0 peer-focus:text-overline peer-focus:text-action',
              'peer-[:not(:placeholder-shown)]:top-1.5 peer-[:not(:placeholder-shown)]:translate-y-0 peer-[:not(:placeholder-shown)]:text-overline',
            )}
          >
            {label}
          </label>
        ) : null}
        {trailingIcon ? (
          <Icon
            name={trailingIcon}
            size="sm"
            className="absolute right-3 text-on-surface-variant pointer-events-none"
          />
        ) : null}
      </div>
      {helperText ? (
        <span id={helperId} className={cn('text-caption', HELPER_COLOR[status])}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
});

export interface FormSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'>,
    BaseFieldProps {
  children: ReactNode;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(function FormSelect(
  {
    id,
    label,
    helperText,
    status = 'default',
    leadingIcon,
    className,
    containerClassName,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const selectId = id ?? reactId;
  const helperId = helperText ? `${selectId}-help` : undefined;

  return (
    <div className={cn('flex flex-col gap-1', containerClassName)}>
      {label ? (
        <label htmlFor={selectId} className="text-caption text-on-surface-variant">
          {label}
        </label>
      ) : null}
      <div className="relative flex items-center">
        {leadingIcon ? (
          <Icon
            name={leadingIcon}
            size="sm"
            className="absolute left-3 text-on-surface-variant pointer-events-none"
          />
        ) : null}
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          aria-invalid={status === 'error' || undefined}
          aria-describedby={helperId}
          className={cn(
            FIELD_BASE,
            STATUS_BORDER[status],
            'h-11 appearance-none',
            leadingIcon ? 'pl-10' : 'pl-4',
            'pr-10',
            className,
          )}
          {...rest}
        >
          {children}
        </select>
        <Icon
          name="expand_more"
          size="sm"
          className="absolute right-3 text-on-surface-variant pointer-events-none"
        />
      </div>
      {helperText ? (
        <span id={helperId} className={cn('text-caption', HELPER_COLOR[status])}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
});
