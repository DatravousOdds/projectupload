import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { getPhotoUrl } from '../api/photos'
import type { Photo } from '../api/photos'
import { formatDate, formatFileSize } from '../lib/format'

type PhotoViewerProps = {
  photos: Photo[]
  photoId: string
  onNavigate: (photoId: string) => void
  onClose: () => void
}

const BUTTON_CLASSES =
  'rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

export function PhotoViewer({ photos, photoId, onNavigate, onClose }: PhotoViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(() => new Set())

  // showModal() gives focus trapping, Esc to close, and returns focus to the thumbnail on close.
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  const index = photos.findIndex((photo) => photo.id === photoId)
  const photo = photos[index]
  const previousPhoto = photos[index - 1]
  const nextPhoto = photos[index + 1]

  if (!photo) return null

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'ArrowLeft' && previousPhoto) onNavigate(previousPhoto.id)
    if (event.key === 'ArrowRight' && nextPhoto) onNavigate(nextPhoto.id)
  }

  const hasDimensions = photo.width !== null && photo.height !== null
  const wasReplaced = photo.updated_at !== photo.created_at

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      aria-label={`Photo ${index + 1} of ${photos.length}: ${photo.file_name}`}
      className="m-auto w-[calc(100%-2rem)] max-w-4xl rounded-lg p-4 backdrop:bg-black/70"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {index + 1} of {photos.length}
        </p>
        <button type="button" onClick={onClose} className={BUTTON_CLASSES}>
          Close
        </button>
      </div>

      <div className="mt-3 flex items-center justify-center rounded bg-gray-100">
        {unavailableIds.has(photo.id) ? (
          <p className="p-12 text-center text-sm text-gray-600">Preview not available in this browser</p>
        ) : (
          <img
            src={getPhotoUrl(photo, 'original')}
            alt={photo.file_name}
            onError={() => setUnavailableIds((previous) => new Set(previous).add(photo.id))}
            className="max-h-[70vh] w-full object-contain"
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-gray-600">File</dt>
          <dd className="truncate">{photo.file_name}</dd>
          <dt className="text-gray-600">Size</dt>
          <dd>
            {hasDimensions && `${photo.width} × ${photo.height} · `}
            {formatFileSize(photo.size_bytes)}
          </dd>
          <dt className="text-gray-600">Uploaded</dt>
          <dd>{formatDate(photo.created_at)}</dd>
          {wasReplaced && (
            <>
              <dt className="text-gray-600">Replaced</dt>
              <dd>{formatDate(photo.updated_at)}</dd>
            </>
          )}
        </dl>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => previousPhoto && onNavigate(previousPhoto.id)}
            disabled={!previousPhoto}
            aria-label="Previous photo"
            className={BUTTON_CLASSES}
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={() => nextPhoto && onNavigate(nextPhoto.id)}
            disabled={!nextPhoto}
            aria-label="Next photo"
            className={BUTTON_CLASSES}
          >
            Next →
          </button>
        </div>
      </div>
    </dialog>
  )
}
