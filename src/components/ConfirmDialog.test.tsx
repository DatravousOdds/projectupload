import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

const onConfirm = vi.fn()
const onCancel = vi.fn()

function renderDialog() {
  return render(
    <ConfirmDialog
      message="Delete this photo? This can't be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ConfirmDialog', () => {
  test('shows the message with Cancel focused by default', () => {
    renderDialog()

    expect(screen.getByRole('dialog')).toHaveTextContent("Delete this photo? This can't be undone.")
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus()
  })

  test('confirms with the confirm button', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  test('cancels with the Cancel button', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })

  test('cancels when closed with Esc', () => {
    renderDialog()

    // Browsers close a modal dialog on Esc; the close event is what the component hears.
    fireEvent(screen.getByRole('dialog'), new Event('close'))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  test('cancels on a click outside the dialog box', () => {
    renderDialog()

    fireEvent.click(screen.getByRole('dialog'))

    expect(onCancel).toHaveBeenCalledOnce()
  })

  test('does not cancel on a click inside the dialog box', () => {
    renderDialog()

    fireEvent.click(screen.getByText("Delete this photo? This can't be undone."))

    expect(onCancel).not.toHaveBeenCalled()
  })

  test('hands focus back to the button that opened it', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const { unmount } = renderDialog()
    unmount()

    expect(opener).toHaveFocus()
    opener.remove()
  })
})
