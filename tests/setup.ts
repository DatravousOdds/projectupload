import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount rendered components between tests; automatic only with Vitest globals, which we don't enable.
afterEach(() => {
  cleanup()
})

// jsdom has no <dialog> methods; stand in for them so components that call showModal() can render.
HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
  this.open = true
}
HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
  this.open = false
  this.dispatchEvent(new Event('close'))
}
