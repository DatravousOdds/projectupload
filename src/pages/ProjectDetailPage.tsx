import { useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import type { Photo } from '../api/photos'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { PhotoGrid } from '../components/PhotoGrid'
import { PhotoViewer } from '../components/PhotoViewer'
import { UploadButton } from '../components/UploadButton'
import { usePhotos } from '../hooks/usePhotos'
import { useProject } from '../hooks/useProject'
import { useUploadPhotos } from '../hooks/useUploadPhotos'
import type { PhotoUpload } from '../hooks/useUploadPhotos'
import { formatDate, formatPhotoCount } from '../lib/format'
import { getPhotoFileError, isValidUuid } from '../lib/validation'
import { NotFoundPage } from './NotFoundPage'

const PLACEHOLDER_TILE_COUNT = 8

export function ProjectDetailPage() {
  const { id } = useParams()
  const projectQuery = useProject(id)
  const photosQuery = usePhotos(id)
  const { uploadStates, uploadPhotos, isUploading } = useUploadPhotos()

  // This visit's uploads, newest first.
  const [uploads, setUploads] = useState<PhotoUpload[]>([])
  const [pickErrors, setPickErrors] = useState<string[]>([])
  const [openPhotoId, setOpenPhotoId] = useState<string | null>(null)

  // Checked before isPending: an invalid id never starts a query, so it would stay pending forever.
  if (!id || !isValidUuid(id)) return <NotFoundPage title="Project not found" />

  const project = projectQuery.data
  const savedPhotos = photosQuery.data ?? []

  // Unfinished uploads get status tiles; finished ones show as photos right away, before the list refreshes.
  const pendingUploads = uploads.filter(({ key }) => uploadStates[key]?.status !== 'done')
  const savedPhotoIds = new Set(savedPhotos.map((photo) => photo.id))
  const justUploadedPhotos = uploads
    .map(({ key }) => uploadStates[key]?.photo)
    .filter((photo): photo is Photo => photo != null && !savedPhotoIds.has(photo.id))
  const visiblePhotos = [...justUploadedPhotos, ...savedPhotos]

  function handlePick(files: File[]) {
    if (!project) return

    const errors: string[] = []
    const newUploads: PhotoUpload[] = []

    for (const file of files) {
      const fileError = getPhotoFileError(file)

      if (fileError) {
        errors.push(fileError)
      } else {
        newUploads.push({ key: crypto.randomUUID(), file })
      }
    }

    setPickErrors(errors)
    if (newUploads.length === 0) return

    setUploads((previous) => [...newUploads, ...previous])
    uploadPhotos(project.id, newUploads)
  }

  function handleRetry(upload: PhotoUpload) {
    if (project) uploadPhotos(project.id, [upload])
  }

  if (projectQuery.isPending) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-6" aria-busy="true">
        <p className="sr-only">Loading project…</p>
        <div aria-hidden="true" className="space-y-3">
          <div className="h-8 w-1/2 rounded bg-gray-200" />
          <div className="h-4 w-2/3 rounded bg-gray-200" />
          <div className="h-4 w-1/3 rounded bg-gray-200" />
        </div>
      </main>
    )
  }

  if (projectQuery.isError) {
    console.error('Failed to load project:', projectQuery.error)

    return (
      <main className="mx-auto max-w-5xl px-4 py-6">
        <ErrorState
          message="Couldn't load this project. Check your connection and try again."
          onRetry={() => projectQuery.refetch()}
        />
      </main>
    )
  }

  if (project === null || project === undefined) return <NotFoundPage title="Project not found" />

  let photosContent: ReactNode

  if (photosQuery.isPending) {
    photosContent = (
      <div aria-busy="true">
        <p className="sr-only">Loading photos…</p>
        <ul aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: PLACEHOLDER_TILE_COUNT }, (_, index) => (
            <li key={index} className="aspect-square rounded bg-gray-200" />
          ))}
        </ul>
      </div>
    )
  } else if (photosQuery.isError) {
    console.error('Failed to load photos:', photosQuery.error)

    photosContent = (
      <ErrorState
        message="Couldn't load the photos. Check your connection and try again."
        onRetry={() => photosQuery.refetch()}
      />
    )
  } else if (visiblePhotos.length === 0 && pendingUploads.length === 0) {
    photosContent = <EmptyState title="No photos yet" message="Upload photos to add them to this project." />
  } else {
    photosContent = (
      <PhotoGrid
        photos={visiblePhotos}
        pendingUploads={pendingUploads}
        uploadStates={uploadStates}
        canRetry={!isUploading}
        onOpen={setOpenPhotoId}
        onRetry={handleRetry}
      />
    )
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="break-words text-2xl font-semibold">{project.name}</h1>
          {project.description && <p className="mt-2 whitespace-pre-line text-gray-700">{project.description}</p>}
          <p className="mt-2 text-sm text-gray-600">
            Created {formatDate(project.created_at)} · {formatPhotoCount(project.photoCount)}
          </p>
        </div>
        <UploadButton onPick={handlePick} disabled={isUploading} />
      </header>

      {pickErrors.length > 0 && (
        <ul role="alert" className="mt-4 space-y-1 text-sm text-red-700">
          {pickErrors.map((pickError) => (
            <li key={pickError}>{pickError}</li>
          ))}
        </ul>
      )}

      <section aria-labelledby="photos-heading" className="mt-6">
        <h2 id="photos-heading" className="sr-only">
          Photos
        </h2>
        {photosContent}
      </section>

      {openPhotoId && (
        <PhotoViewer
          photos={visiblePhotos}
          photoId={openPhotoId}
          onNavigate={setOpenPhotoId}
          onClose={() => setOpenPhotoId(null)}
        />
      )}
    </main>
  )
}
