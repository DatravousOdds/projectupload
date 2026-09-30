import { useRef } from 'react'
import type { ChangeEvent } from 'react'

type UploadButtonProps = { onPick: (files: File[]) => void; disabled?: boolean }

export function UploadButton({ onPick, disabled = false }: UploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    // Reset so picking the same file again still fires a change.
    event.target.value = ''
    if (files.length > 0) onPick(files)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Upload photos
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleChange}
        aria-label="Choose photos to upload"
        className="hidden"
      />
    </>
  )
}
