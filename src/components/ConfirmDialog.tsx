import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'

type ConfirmDialogProps = {
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

const BUTTON_CLASSES =
  'rounded px-4 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

export function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Cancel gets focus so Enter never confirms a destructive action by accident.
  // The dialog unmounts rather than calling close(), so focus is handed back to the opener by hand.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.showModal()
    cancelRef.current?.focus()

    return () => opener?.focus()
  }, [])

  // The dialog has no padding of its own, so a click that lands on it directly was on the backdrop.
  function handleClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === event.currentTarget) onCancel()
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onCancel}
      onClick={handleClick}
      aria-label={message}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg p-0 backdrop:bg-black/50"
    >
      <div className="p-5">
        <p>{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className={`${BUTTON_CLASSES} border border-gray-300 hover:bg-gray-50`}
          >
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className={`${BUTTON_CLASSES} bg-red-600 text-white hover:bg-red-700`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  )
}
