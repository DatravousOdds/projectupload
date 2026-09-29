import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent, SyntheticEvent } from 'react'
import { useCreateProject } from '../hooks/useProjects'
import { useUploadPhotos } from '../hooks/useUploadPhotos'
import type { PhotoUpload } from '../hooks/useUploadPhotos'
import { getPhotoFileError, validateProjectInput } from '../lib/validation'
import type { ProjectInputErrors } from '../lib/validation'
import { PhotoPickerGrid } from './PhotoPickerGrid'
import type { PickedPhoto } from './PhotoPickerGrid'

type ProjectFormModalProps = { onClose: () => void }

const FIELD_CLASSES =
  'mt-1 w-full rounded border border-gray-300 px-3 py-2 disabled:bg-gray-100 aria-invalid:border-red-600 focus-visible:outline-2 focus-visible:outline-blue-600'

const BUTTON_FOCUS_CLASSES = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

const SECONDARY_BUTTON_CLASSES = `rounded border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:opacity-50 ${BUTTON_FOCUS_CLASSES}`

export function ProjectFormModal({ onClose }: ProjectFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const addPhotosInputRef = useRef<HTMLInputElement>(null)
  const replacePhotoInputRef = useRef<HTMLInputElement>(null)
  const replacingKeyRef = useRef<string | null>(null)
  // Every preview URL still alive, so all can be freed when the form closes.
  const previewUrlsRef = useRef(new Set<string>())

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ProjectInputErrors>({})
  const [pickedPhotos, setPickedPhotos] = useState<PickedPhoto[]>([])
  const [pickErrors, setPickErrors] = useState<string[]>([])
  // Set once the project is saved, so a retry uploads into it instead of creating another.
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  const createProject = useCreateProject()
  const { uploadStates, uploadPhotos, isUploading } = useUploadPhotos()

  const isBusy = createProject.isPending || isUploading
  const isProjectCreated = createdProjectId !== null
  const hasFailedUploads = pickedPhotos.some(({ key }) => uploadStates[key]?.status === 'failed')

  // showModal() gives focus trapping, Esc to close and the backdrop; rendering <dialog open> doesn't.
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    const previewUrls = previewUrlsRef.current

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url))
      previewUrls.clear()
    }
  }, [])

  function createPreviewUrl(file: File): string {
    const url = URL.createObjectURL(file)
    previewUrlsRef.current.add(url)
    return url
  }

  function revokePreviewUrl(url: string) {
    URL.revokeObjectURL(url)
    previewUrlsRef.current.delete(url)
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Keep the dialog open on Esc while saving or uploading, so the result isn't lost.
    if (isBusy) event.preventDefault()
  }

  function handleAddPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    // Reset so picking the same file again still fires a change.
    event.target.value = ''

    const errors: string[] = []
    const newPhotos: PickedPhoto[] = []

    for (const file of files) {
      const fileError = getPhotoFileError(file)

      if (fileError) {
        errors.push(fileError)
      } else {
        newPhotos.push({ key: crypto.randomUUID(), file, previewUrl: createPreviewUrl(file) })
      }
    }

    setPickErrors(errors)
    setPickedPhotos((previous) => [...previous, ...newPhotos])
  }

  function handleRemovePhoto(key: string) {
    const photo = pickedPhotos.find((picked) => picked.key === key)
    if (photo) revokePreviewUrl(photo.previewUrl)

    setPickedPhotos((previous) => previous.filter((picked) => picked.key !== key))
  }

  function handleReplaceClick(key: string) {
    replacingKeyRef.current = key
    replacePhotoInputRef.current?.click()
  }

  function handleReplacePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    const key = replacingKeyRef.current
    event.target.value = ''
    replacingKeyRef.current = null

    if (!file || !key) return

    const fileError = getPhotoFileError(file)
    if (fileError) {
      setPickErrors([fileError])
      return
    }

    const photo = pickedPhotos.find((picked) => picked.key === key)
    if (photo) revokePreviewUrl(photo.previewUrl)

    const previewUrl = createPreviewUrl(file)
    setPickErrors([])
    setPickedPhotos((previous) =>
      previous.map((picked) => (picked.key === key ? { ...picked, file, previewUrl } : picked)),
    )
  }

  function toUploads(photos: PickedPhoto[]): PhotoUpload[] {
    return photos.map(({ key, file }) => ({ key, file }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = validateProjectInput({ name, description })

    if (!result.isValid) {
      setFieldErrors(result.errors)
      return
    }

    setFieldErrors({})

    createProject.mutate(result.project, {
      onSuccess: async (project) => {
        setCreatedProjectId(project.id)

        const { failedKeys } = await uploadPhotos(project.id, toUploads(pickedPhotos))

        // All saved: back to the list. Otherwise stay open so failed photos can be retried.
        if (failedKeys.length === 0) onClose()
      },
      onError: (error) => console.error('Failed to create project:', error),
    })
  }

  function handleRetry(key: string) {
    const photo = pickedPhotos.find((picked) => picked.key === key)
    if (!photo || !createdProjectId) return

    uploadPhotos(createdProjectId, toUploads([photo]))
  }

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={handleCancel}
      aria-labelledby="project-form-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg p-6 backdrop:bg-black/40"
    >
      <h2 id="project-form-title" className="text-lg font-semibold">
        New project
      </h2>

      <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-4">
        <div>
          <label htmlFor="project-name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={isProjectCreated}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? 'project-name-error' : undefined}
            className={FIELD_CLASSES}
          />
          {fieldErrors.name && (
            <p id="project-name-error" className="mt-1 text-sm text-red-700">
              {fieldErrors.name}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="project-description" className="block text-sm font-medium">
            Description <span className="font-normal text-gray-600">(optional)</span>
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            disabled={isProjectCreated}
            rows={3}
            aria-invalid={fieldErrors.description ? true : undefined}
            aria-describedby={fieldErrors.description ? 'project-description-error' : undefined}
            className={FIELD_CLASSES}
          />
          {fieldErrors.description && (
            <p id="project-description-error" className="mt-1 text-sm text-red-700">
              {fieldErrors.description}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Photos <span className="font-normal text-gray-600">(optional)</span>
            </span>
            <button
              type="button"
              onClick={() => addPhotosInputRef.current?.click()}
              disabled={isProjectCreated || isBusy}
              className={`text-sm ${SECONDARY_BUTTON_CLASSES}`}
            >
              Add photos
            </button>
          </div>

          <input
            ref={addPhotosInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleAddPhotos}
            data-testid="add-photos-input"
            className="hidden"
          />
          <input
            ref={replacePhotoInputRef}
            type="file"
            accept="image/*"
            onChange={handleReplacePhoto}
            data-testid="replace-photo-input"
            className="hidden"
          />

          {pickErrors.length > 0 && (
            <ul role="alert" className="space-y-1 text-sm text-red-700">
              {pickErrors.map((pickError) => (
                <li key={pickError}>{pickError}</li>
              ))}
            </ul>
          )}

          {pickedPhotos.length > 0 && (
            <PhotoPickerGrid
              photos={pickedPhotos}
              uploadStates={uploadStates}
              canEdit={!isProjectCreated && !isBusy}
              canRetry={isProjectCreated && !isBusy}
              onRemove={handleRemovePhoto}
              onReplace={handleReplaceClick}
              onRetry={handleRetry}
            />
          )}
        </div>

        {createProject.isError && (
          <p role="alert" className="text-sm text-red-700">
            Couldn't create the project. Check your connection and try again.
          </p>
        )}

        {isProjectCreated && !isBusy && (
          <p role="status" className="text-sm text-gray-700">
            {hasFailedUploads
              ? "Project saved. Some photos didn't upload; retry them or close to continue."
              : 'Project saved with all its photos.'}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isBusy} className={SECONDARY_BUTTON_CLASSES}>
            {isProjectCreated ? 'Close' : 'Cancel'}
          </button>
          {!isProjectCreated && (
            <button
              type="submit"
              disabled={isBusy}
              className={`rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50 ${BUTTON_FOCUS_CLASSES}`}
            >
              {createProject.isPending ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </dialog>
  )
}
