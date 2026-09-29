import type { ReactNode } from 'react'
import { ProjectCard } from '../components/ProjectCard'
import { useProjects } from '../hooks/useProjects'

// Shared by the loading placeholders and the real list so nothing shifts when data arrives.
const PROJECT_GRID_CLASSES = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'

const PLACEHOLDER_CARD_COUNT = 3

export function ProjectListPage() {
  const { data: projects, isPending, isError, error, refetch } = useProjects()

  let content: ReactNode

  if (isPending) {
    content = (
      <div aria-busy="true">
        <p className="sr-only">Loading projects…</p>

        <ul className={PROJECT_GRID_CLASSES} aria-hidden="true">
          {Array.from({ length: PLACEHOLDER_CARD_COUNT }, (_, index) => (
            <li key={index} className="rounded-lg border border-gray-200 p-3">
              <div className="aspect-[4/3] rounded bg-gray-200" />
              <div className="mt-3 h-5 w-2/3 rounded bg-gray-200" />
              <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
            </li>
          ))}
        </ul>
      </div>
    )
  } else if (isError) {
    console.error('Failed to load projects:', error)

    content = (
      <div role="alert" className="rounded-lg border border-gray-200 p-6 text-center">
        <p>Couldn't load projects. Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded border border-gray-300 px-4 py-2 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          Try again
        </button>
      </div>
    )
  } else if (projects.length === 0) {
    content = (
      <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
        <p className="font-semibold">No projects yet</p>
        <p className="mt-1 text-sm text-gray-600">Create your first project to start adding photos.</p>
      </div>
    )
  } else {
    content = (
      <ul className={PROJECT_GRID_CLASSES}>
        {projects.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Projects</h1>
        {/* Opens ProjectFormModal in the next step. */}
        <button
          type="button"
          className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          New project
        </button>
      </header>

      <main className="mt-6">{content}</main>

      <footer className="mt-10 text-sm text-gray-600">
        <p>Projects and photos here are public.</p>
      </footer>
    </div>
  )
}
