import Modal from './Modal'
import Button from './Button'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** Uses the danger button treatment for the confirm action — delete, remove, permanent actions. */
  danger?: boolean
  loading?: boolean
}

/**
 * Shared confirmation dialog for dangerous/irreversible actions (delete project,
 * remove member, delete permanently, etc.). Intended to eventually replace the
 * browser's window.confirm() calls currently used in Projects.tsx / AdminPanel.tsx
 * — that swap happens in a later step, this component just makes it available.
 */
export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} size="sm" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <span className="sr-only">Confirmation required</span>
    </Modal>
  )
}
