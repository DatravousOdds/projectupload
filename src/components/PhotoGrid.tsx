import { useState } from 'react'
import { getPhotoUrl } from '../api/photos'
import type { Photo } from '../api/photos'
import { UPLOAD_STATUS_LABELS } from '../hooks/useUploadPhotos'
import type { PhotoUpload, UploadState } from '../hooks/useUploadPhotos'

type PhotoGridProps = {
  photos: Photo[]
  pendingUploads: PhotoUpload[]
  uploadStates: Record<string, UploadState>
  canRetry: boolean
  onOpen: (photoId: string) => void
  onRetry: (upload: PhotoUpload) => void
}

const TILE_CLASSES = 'aspect-square w-full rounded bg-gray-200'

const FOCUS_CLASSES = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

export function PhotoGrid({ photos, pendingUploads, uploadStates, canRetry, onOpen, onRetry }: PhotoGridProps) {
  // Photos the browser can't display (e.g. HEIC outside Safari) show a placeholder instead of a broken image.
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(() => new Set())

  function markUnavailable(photoId: string) {
    setUnavailableIds((previous) => new Set(previous).add(photoId))
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {pendingUploads.map((upload) => {
        const uploadState = uploadStates[upload.key]

        return (
          <li key={upload.key}>
            <div
              className={`${TILE_CLASSES} flex flex-col items-center justify-center gap-2 p-2 text-center text-xs text-gray-700`}
            >
              <span className="w-full truncate">{upload.file.name}</span>
              {uploadState?.status === 'failed' ? (
                <>
                  <span className="text-red-700">{uploadState.errorMessage}</span>
                  {canRetry && (
                    <button
                      type="button"
                      onClick={() => onRetry(upload)}
                      aria-label={`Retry ${upload.file.name}`}
                      className={`rounded border border-gray-300 bg-white px-2 py-1 hover:bg-gray-50 ${FOCUS_CLASSES}`}
                    >
                      Retry
                    </button>
                  )}
                </>
              ) : (
                uploadState && <span>{UPLOAD_STATUS_LABELS[uploadState.status]}</span>
              )}
            </div>
          </li>
        )
      })}

      {photos.map((photo) => (
        <li key={photo.id}>
          <button
            type="button"
            onClick={() => onOpen(photo.id)}
            aria-label={`Open ${photo.file_name}`}
            className={`block w-full rounded ${FOCUS_CLASSES}`}
          >
            {unavailableIds.has(photo.id) ? (
              <span className={`${TILE_CLASSES} flex items-center justify-center p-2 text-center text-xs text-gray-600`}>
                Preview not available in this browser
              </span>
            ) : (
              <img
                src={getPhotoUrl(photo, 'thumb')}
                alt=""
                loading="lazy"
                onError={() => markUnavailable(photo.id)}
                className={`${TILE_CLASSES} object-cover`}
              />
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
