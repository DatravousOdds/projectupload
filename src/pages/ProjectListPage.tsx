import type { ReactNode } from 'react';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { ProjectCard } from '../components/ProjectCard';
import { ProjectFormModal } from '../components/ProjectFormModal';
import { useProjects } from '../hooks/useProjects';
import { useState } from 'react';


// Shared by the loading placeholders and the real list so nothing shifts when data arrives.
const PROJECT_GRID_CLASSES = 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3';
const PLACEHOLDER_CARD_COUNT = 6;



export function ProjectListPage() {
  const [isFormOpen, setFormOpen] = useState(false);
  const { data: projects, isPending, isError, error, refetch } = useProjects();

  function handleClick() {
    setFormOpen(true);
  }

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
      <ErrorState message="Couldn't load projects. Check your connection and try again." onRetry={() => refetch()} />
    )
  } else if (projects.length === 0) {
    content = <EmptyState title="No projects yet" message="Create your first project to start adding photos." />
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
        <button
          onClick={handleClick}
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

      {isFormOpen && <ProjectFormModal onClose={() => setFormOpen(false)} />}
    </div>
  )
}
