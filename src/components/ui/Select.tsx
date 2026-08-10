import { forwardRef, useId, type SelectHTMLAttributes } from 'react'

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
}

/**
 * Shared select input. Same label/error chrome as Input.tsx so a form mixing text
 * fields and dropdowns (e.g. the project create/edit modal's language picker) looks
 * like one consistent form instead of two different styles.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, hint, id, className = '', required, children, ...rest },
  ref
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={fieldId} className="text-xs uppercase tracking-wide text-gray-400">
          {label}
          {required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={fieldId}
        required={required}
        aria-invalid={Boolean(error)}
        className={`input-field w-full ${error ? 'border-danger/50 focus:border-danger/70' : ''} ${className}`}
        {...rest}
      >
        {children}
      </select>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
})

export default Select
