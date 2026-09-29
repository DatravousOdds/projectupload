import { useEffect, useRef, useState } from 'react'
import type { FormEvent, SyntheticEvent } from 'react'
import { useNavigate } from 'react-router'
import { useCreateProject } from '../hooks/useProjects'
import { validateProjectInput } from '../lib/validation'
import type { ProjectInputErrors } from '../lib/validation'

type ProjectFormModalProps = { onClose: () => void }

const FIELD_CLASSES =
  'mt-1 w-full rounded border border-gray-300 px-3 py-2 aria-invalid:border-red-600 focus-visible:outline-2 focus-visible:outline-blue-600'

const BUTTON_FOCUS_CLASSES = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'

export function ProjectFormModal({ onClose }: ProjectFormModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<ProjectInputErrors>({})

  const createProject = useCreateProject()
  const navigate = useNavigate()

  // showModal() gives focus trapping, Esc to close and the backdrop; rendering <dialog open> doesn't.
  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Keep the dialog open on Esc while saving, so the result isn't lost.
    if (createProject.isPending) event.preventDefault()
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
      onSuccess: (project) => navigate(`/projects/${project.id}`),
      onError: (error) => console.error('Failed to create project:', error),
    })
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

        {createProject.isError && (
          <p role="alert" className="text-sm text-red-700">
            Couldn't create the project. Check your connection and try again.
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={createProject.isPending}
            className={`rounded border border-gray-300 px-4 py-2 hover:bg-gray-50 disabled:opacity-50 ${BUTTON_FOCUS_CLASSES}`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createProject.isPending}
            className={`rounded bg-gray-900 px-4 py-2 text-white hover:bg-gray-700 disabled:opacity-50 ${BUTTON_FOCUS_CLASSES}`}
          >
            {createProject.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
