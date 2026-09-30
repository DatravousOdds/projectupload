import { UPLOAD_STATUS_LABELS } from '../hooks/useUploadPhotos'
import type { UploadState } from '../hooks/useUploadPhotos'

export type PickedPhoto = { key: string; file: File; previewUrl: string }

type PhotoPickerGridProps = {
  photos: PickedPhoto[]
  uploadStates: Record<string, UploadState>
  canEdit: boolean
  canRetry: boolean
  onRemove: (key: string) => void
  onReplace: (key: string) => void
  onRetry: (key: string) => void
}

const FOCUS_CLASSES = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

const SMALL_BUTTON_CLASSES = `rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 ${FOCUS_CLASSES}`

const ICON_BUTTON_CLASSES = `absolute top-1 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-gray-800 shadow hover:bg-white ${FOCUS_CLASSES}`

// Stroke icons drawn inline, so no icon library is needed.
function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  )
}

export function PhotoPickerGrid({
  photos,
  uploadStates,
  canEdit,
  canRetry,
  onRemove,
  onReplace,
  onRetry,
}: PhotoPickerGridProps) {
  return (
    <ul className="grid grid-cols-3 gap-2">
      {photos.map(({ key, file, previewUrl }) => {
        const uploadState = uploadStates[key]

        return (
          <li key={key} className="flex flex-col gap-1">
            <div className="group relative">
              <img src={previewUrl} alt={file.name} className="aspect-square w-full rounded bg-gray-200 object-cover" />

              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => onRemove(key)}
                    aria-label={`Remove ${file.name}`}
                    className={`${ICON_BUTTON_CLASSES} left-1`}
                  >
                    <XIcon />
                  </button>
                  {/* Shown on hover or keyboard focus; always visible on touch screens, which can't hover. */}
                  <button
                    type="button"
                    onClick={() => onReplace(key)}
                    aria-label={`Replace ${file.name}`}
                    className={`${ICON_BUTTON_CLASSES} right-1 [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100`}
                  >
                    <PencilIcon />
                  </button>
                </>
              )}
            </div>

            {uploadState?.status === 'failed' && (
              <p className="text-xs text-red-700">{uploadState.errorMessage}</p>
            )}

            {uploadState && uploadState.status !== 'failed' && (
              <p className="text-xs text-gray-600">{UPLOAD_STATUS_LABELS[uploadState.status]}</p>
            )}

            {canRetry && uploadState?.status === 'failed' && (
              <button
                type="button"
                onClick={() => onRetry(key)}
                aria-label={`Retry ${file.name}`}
                className={`${SMALL_BUTTON_CLASSES} self-start`}
              >
                Retry
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}
