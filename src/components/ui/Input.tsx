import { forwardRef, useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FieldChrome {
  label?: string
  error?: string
  hint?: string
}

type InputProps = FieldChrome & InputHTMLAttributes<HTMLInputElement>
type TextareaProps = FieldChrome & TextareaHTMLAttributes<HTMLTextAreaElement>

function FieldWrapper({
  id,
  label,
  error,
  hint,
  required,
  children,
}: FieldChrome & { id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="text-xs uppercase tracking-wide text-gray-400">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * Shared text input. Wraps .input-field (Step 1) with a consistent label / error / hint
 * layout so every form in the app (create/edit modals, settings, IP allowlist, etc.)
 * shares one implementation instead of hand-rolling label+input+error each time.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className = '', required, ...rest },
  ref
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldWrapper id={fieldId} label={label} error={error} hint={hint} required={required}>
      <input
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        className={`input-field w-full ${error ? 'border-danger/50 focus:border-danger/70' : ''} ${className}`}
        {...rest}
      />
    </FieldWrapper>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, hint, id, className = '', required, rows = 3, ...rest },
  ref
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <FieldWrapper id={fieldId} label={label} error={error} hint={hint} required={required}>
      <textarea
        ref={ref}
        id={fieldId}
        required={required}
        rows={rows}
        aria-invalid={Boolean(error)}
        className={`input-field w-full resize-none ${error ? 'border-danger/50 focus:border-danger/70' : ''} ${className}`}
        {...rest}
      />
    </FieldWrapper>
  )
})
