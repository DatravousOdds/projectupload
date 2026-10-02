import { useState } from 'react'
import { ProjectFormModal } from './ProjectFormModal'

// The project list's header; owns the New project form so the page doesn't have to.
export function AppHeader() {
  const [isFormOpen, setIsFormOpen] = useState(false)

  return (
    <>
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <button
          type="button"
          onClick={() => setIsFormOpen(true)}
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          New project
        </button>
      </header>

      {isFormOpen && <ProjectFormModal onClose={() => setIsFormOpen(false)} />}
    </>
  )
}
