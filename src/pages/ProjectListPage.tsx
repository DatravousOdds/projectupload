import type { ReactNode } from 'react';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { AppHeader } from '../components/AppHeader';
import { COVER_CLASSES, ProjectCard } from '../components/ProjectCard';
import { useProjects } from '../hooks/useProjects';

// Shared by the loading placeholders and the real list so nothing shifts when data arrives.
const PROJECT_LIST_CLASSES = 'flex flex-col gap-3';
const PLACEHOLDER_CARD_COUNT = 6;

export function ProjectListPage() {
  const { data: projects, isPending, isError, error, refetch } = useProjects();

  let content: ReactNode

  if (isPending) {
    content = (
      <div aria-busy="true">
        <p className="sr-only">Loading projects…</p>

        <ul className={PROJECT_LIST_CLASSES} aria-hidden="true">
          {Array.from({ length: PLACEHOLDER_CARD_COUNT }, (_, index) => (
            <li key={index} className="flex items-center gap-4 rounded-lg border border-gray-200 p-3">
              <div className={COVER_CLASSES} />
              <div className="flex-1">
                <div className="h-5 w-2/3 rounded bg-gray-200" />
                <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />
              </div>
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
      <ul className={PROJECT_LIST_CLASSES}>
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
      <AppHeader />

      <main className="mt-6">{content}</main>

      <footer className="mt-10 text-sm text-gray-600">
        <p>Projects and photos here are public.</p>
      </footer>
    </div>
  )
}
