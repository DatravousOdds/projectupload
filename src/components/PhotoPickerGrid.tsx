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

const STATUS_LABELS = {
  waiting: 'Waiting…',
  uploading: 'Uploading…',
  done: 'Uploaded',
} as const

const SMALL_BUTTON_CLASSES =
  'rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

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
            <img src={previewUrl} alt={file.name} className="aspect-square w-full rounded bg-gray-200 object-cover" />

            {uploadState?.status === 'failed' && (
              <p className="text-xs text-red-700">{uploadState.errorMessage}</p>
            )}

            {uploadState && uploadState.status !== 'failed' && (
              <p className="text-xs text-gray-600">{STATUS_LABELS[uploadState.status]}</p>
            )}

            <div className="flex flex-wrap gap-1">
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => onReplace(key)}
                    aria-label={`Replace ${file.name}`}
                    className={SMALL_BUTTON_CLASSES}
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(key)}
                    aria-label={`Remove ${file.name}`}
                    className={SMALL_BUTTON_CLASSES}
                  >
                    Remove
                  </button>
                </>
              )}

              {canRetry && uploadState?.status === 'failed' && (
                <button
                  type="button"
                  onClick={() => onRetry(key)}
                  aria-label={`Retry ${file.name}`}
                  className={SMALL_BUTTON_CLASSES}
                >
                  Retry
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
