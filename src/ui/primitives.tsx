import type { ButtonHTMLAttributes, ReactNode } from 'react';

/** Minimum hit area for every control: 32px with a mouse, 44px on touch. */
const hit = 'min-h-8 pointer-coarse:min-h-11 pointer-coarse:min-w-11';
const hitSquare = 'size-9 pointer-coarse:size-11';

export function SectionHeading({ children, id, className = '' }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <h3 id={id} className={`text-label font-bold uppercase tracking-widest text-ink-muted ${className}`}>
      {children}
    </h3>
  );
}

type ButtonVariant = 'default' | 'quiet' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  default: 'px-3 border border-border-muted bg-surface text-ink hover:border-ink-muted',
  quiet: 'px-1 text-ink underline underline-offset-2 hover:text-white',
  danger: 'px-1 text-red-400 hover:text-red-300',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** An action. One-of-N choices use Segmented instead. */
export function Button({ variant = 'default', className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`${hit} inline-flex items-center justify-center gap-1 rounded-lg text-xs font-bold transition-colors ${BUTTON_VARIANTS[variant]} ${className}`}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: string;
  /** Used as the accessible name and the tooltip. */
  label: string;
}

export function IconButton({ icon, label, className = '', ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      title={props.title ?? label}
      className={`${hitSquare} shrink-0 flex items-center justify-center rounded-lg border border-border-muted bg-surface text-ink hover:border-ink-muted transition-colors ${className}`}
    >
      <span className="material-symbols-outlined text-lg" aria-hidden="true">{icon}</span>
    </button>
  );
}

interface SegmentedProps<T extends string | number> {
  /** Accessible name of the group. */
  label: string;
  options: readonly { value: T; label: ReactNode; title?: string }[];
  /** null when nothing is selected. */
  value: T | null;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Tooltip explaining why the control is disabled. */
  disabledHint?: string;
  className?: string;
}

/** The one control for picking one of a few options. Selected is a solid neutral fill; green is reserved for targets. */
export function Segmented<T extends string | number>({ label, options, value, onChange, disabled, disabledHint, className = '' }: SegmentedProps<T>) {
  return (
    <div role="group" aria-label={label} className={`flex flex-wrap gap-1 rounded-lg border border-border-muted bg-surface p-1 ${className}`}>
      {options.map((option) => (
        <button
          key={option.value}
          disabled={disabled}
          aria-pressed={option.value === value}
          title={disabled ? disabledHint : option.title}
          className={`${hit} min-w-8 flex-1 inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs font-bold transition-colors ${
            option.value === value ? 'bg-ink text-background-dark' : 'text-ink-muted hover:text-ink'
          }`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface SelectProps<T extends string | number> {
  label: string;
  /** Show the label beside the control; otherwise it is only the accessible name. */
  showLabel?: boolean;
  options: readonly { value: T; label: string }[];
  value: T | '';
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function Select<T extends string | number>({ label, showLabel, options, value, onChange, disabled, className = '' }: SelectProps<T>) {
  const select = (
    <select
      aria-label={showLabel ? undefined : label}
      disabled={disabled}
      className={`${hit} min-w-0 flex-1 rounded-lg border border-border-muted bg-surface px-2 text-xs text-ink ${showLabel ? '' : className}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
  if (!showLabel) return select;
  return <label className={`flex items-center gap-2 text-xs text-ink-muted ${className}`}>{label}{select}</label>;
}
