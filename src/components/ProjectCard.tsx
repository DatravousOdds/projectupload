import { Link } from 'react-router'
import type { ProjectWithPhotoCount } from '../api/projects'
import { formatDate, formatPhotoCount } from '../lib/format'

type ProjectCardProps = { project: ProjectWithPhotoCount }

export function ProjectCard({ project }: ProjectCardProps) {
  const photoLabel = formatPhotoCount(project.photoCount)
  const updatedDate = formatDate(project.updated_at)

  return (
    <Link
      to={`/projects/${project.id}`}
      className="block rounded-lg border border-gray-200 p-3 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      {/* Cover placeholder until photos exist (step 6); fixed ratio keeps card height stable. */}
      <div className="aspect-[4/3] rounded bg-gray-200" />

      <h2 className="mt-3 truncate font-semibold">{project.name}</h2>

      <p className="mt-1 flex justify-between text-sm text-gray-600">
        <span>{photoLabel}</span>
        <span>Updated {updatedDate}</span>
      </p>
    </Link>
  )
}
