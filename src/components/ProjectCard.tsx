import { useState } from 'react'
import { Link } from 'react-router'
import { getPhotoUrl } from '../api/photos'
import type { ProjectListItem } from '../api/projects'
import { formatDate, formatPhotoCount } from '../lib/format'

type ProjectCardProps = { project: ProjectListItem }

// Fixed size and no shrinking, so every row's text starts at the same place.
export const COVER_CLASSES = 'aspect-[4/3] w-24 shrink-0 rounded bg-gray-200 sm:w-32'

export function ProjectCard({ project }: ProjectCardProps) {
  // A cover the browser can't display (e.g. HEIC outside Safari) falls back to the grey box.
  const [isCoverUnavailable, setIsCoverUnavailable] = useState(false)

  const photoLabel = formatPhotoCount(project.photoCount)
  const updatedDate = formatDate(project.updated_at)
  const coverPhoto = isCoverUnavailable ? null : project.coverPhoto

  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex items-center gap-4 rounded-lg border border-gray-200 p-3 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
    >
      {/* Newest photo as the cover; the fixed size keeps every row the same height. */}
      {coverPhoto ? (
        <img
          src={getPhotoUrl(coverPhoto, 'thumb')}
          alt=""
          loading="lazy"
          onError={() => setIsCoverUnavailable(true)}
          className={`${COVER_CLASSES} object-cover`}
        />
      ) : (
        <div className={COVER_CLASSES} />
      )}

      {/* min-w-0 lets a long name truncate instead of pushing the row wider than the screen. */}
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-semibold">{project.name}</h2>

        <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-gray-600">
          <span>{photoLabel}</span>
          <span>Updated {updatedDate}</span>
        </p>
      </div>
    </Link>
  )
}
