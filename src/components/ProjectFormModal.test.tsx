import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useCreateProject } from '../hooks/useProjects'
import { useUploadPhotos } from '../hooks/useUploadPhotos'
import type { UploadState } from '../hooks/useUploadPhotos'
import { ProjectFormModal } from './ProjectFormModal'

// The form is tested against fake hooks; the real hooks and api have their own coverage.
vi.mock('../hooks/useProjects', () => ({ useCreateProject: vi.fn() }))
vi.mock('../hooks/useUploadPhotos', () => ({ useUploadPhotos: vi.fn() }))

const PROJECT_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'

const mutate = vi.fn()
const uploadPhotos = vi.fn()
const onClose = vi.fn()

type CreateProjectResult = ReturnType<typeof useCreateProject>
type UploadPhotosResult = ReturnType<typeof useUploadPhotos>

function mockCreateProject(state: { isPending?: boolean; isError?: boolean } = {}) {
  vi.mocked(useCreateProject).mockReturnValue({
    mutate,
    isPending: state.isPending ?? false,
    isError: state.isError ?? false,
  } as unknown as CreateProjectResult)
}

function mockUploadPhotos(state: { uploadStates?: Record<string, UploadState>; isUploading?: boolean } = {}) {
  vi.mocked(useUploadPhotos).mockReturnValue({
    uploadPhotos,
    uploadStates: state.uploadStates ?? {},
    isUploading: state.isUploading ?? false,
  } as UploadPhotosResult)
}

function makeImage(name: string) {
  return new File(['x'], name, { type: 'image/jpeg' })
}

function fillName(value: string) {
  fireEvent.change(screen.getByLabelText('Name'), { target: { value } })
}

function clickSave() {
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
}

function pickPhotos(...files: File[]) {
  fireEvent.change(screen.getByTestId('add-photos-input'), { target: { files } })
}

// Runs the create mutation's success callback, as TanStack would once Supabase answers.
async function finishCreatingProject() {
  const { onSuccess } = mutate.mock.calls[0][1]
  await act(async () => {
    await onSuccess({ id: PROJECT_ID })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreateProject()
  mockUploadPhotos()
  uploadPhotos.mockResolvedValue({ failedKeys: [] })

  let keyNumber = 0
  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    keyNumber += 1
    return `00000000-0000-4000-8000-00000000000${keyNumber}`
  })

  // jsdom has no object URLs.
  URL.createObjectURL = vi.fn((file: Blob) => `blob:${(file as File).name}`)
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ProjectFormModal: project details', () => {
  test('shows an inline error and does not save when the name is blank', () => {
    render(<ProjectFormModal onClose={onClose} />)

    fillName('   ')
    clickSave()

    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(mutate).not.toHaveBeenCalled()
  })

  test('saves the trimmed values', () => {
    render(<ProjectFormModal onClose={onClose} />)

    fillName('  Garden  ')
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: '  Spring beds  ' } })
    clickSave()

    expect(mutate).toHaveBeenCalledWith({ name: 'Garden', description: 'Spring beds' }, expect.any(Object))
  })

  test('closes and returns to the list after saving a project with no photos', async () => {
    render(<ProjectFormModal onClose={onClose} />)

    fillName('Garden')
    clickSave()
    await finishCreatingProject()

    expect(onClose).toHaveBeenCalledOnce()
  })

  test('disables the buttons while saving', () => {
    mockCreateProject({ isPending: true })

    render(<ProjectFormModal onClose={onClose} />)

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add photos' })).toBeDisabled()
  })

  test('shows a message when saving fails', () => {
    mockCreateProject({ isError: true })

    render(<ProjectFormModal onClose={onClose} />)

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't create the project.")
  })

  test('calls onClose when Cancel is clicked', () => {
    render(<ProjectFormModal onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('ProjectFormModal: picking photos', () => {
  test('adds picked photos to the grid, across more than one pick', () => {
    render(<ProjectFormModal onClose={onClose} />)

    pickPhotos(makeImage('front.jpg'), makeImage('back.jpg'))
    pickPhotos(makeImage('side.jpg'))

    expect(screen.getByRole('img', { name: 'front.jpg' })).toHaveAttribute('src', 'blob:front.jpg')
    expect(screen.getByRole('img', { name: 'back.jpg' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'side.jpg' })).toBeInTheDocument()
  })

  test('rejects files that are not supported images and keeps the valid ones', () => {
    render(<ProjectFormModal onClose={onClose} />)

    pickPhotos(makeImage('front.jpg'), new File(['x'], 'notes.pdf', { type: 'application/pdf' }))

    expect(screen.getByRole('alert')).toHaveTextContent('"notes.pdf" isn\'t a supported image.')
    expect(screen.getByRole('img', { name: 'front.jpg' })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'notes.pdf' })).not.toBeInTheDocument()
  })

  test('removes a photo without asking and frees its preview', () => {
    render(<ProjectFormModal onClose={onClose} />)

    pickPhotos(makeImage('front.jpg'))
    fireEvent.click(screen.getByRole('button', { name: 'Remove front.jpg' }))

    expect(screen.queryByRole('img', { name: 'front.jpg' })).not.toBeInTheDocument()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:front.jpg')
  })

  test('replaces a photo in the same place and frees the old preview', () => {
    render(<ProjectFormModal onClose={onClose} />)

    pickPhotos(makeImage('front.jpg'), makeImage('back.jpg'))
    fireEvent.click(screen.getByRole('button', { name: 'Replace front.jpg' }))
    fireEvent.change(screen.getByTestId('replace-photo-input'), { target: { files: [makeImage('new-front.jpg')] } })

    const images = screen.getAllByRole('img').map((image) => image.getAttribute('alt'))
    expect(images).toEqual(['new-front.jpg', 'back.jpg'])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:front.jpg')
  })

  test('frees every preview when the form closes', () => {
    const { unmount } = render(<ProjectFormModal onClose={onClose} />)

    pickPhotos(makeImage('front.jpg'), makeImage('back.jpg'))
    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:front.jpg')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:back.jpg')
  })
})

describe('ProjectFormModal: uploading on save', () => {
  test('uploads the picked photos into the new project, then closes', async () => {
    render(<ProjectFormModal onClose={onClose} />)

    const front = makeImage('front.jpg')
    pickPhotos(front)
    fillName('Garden')
    clickSave()
    await finishCreatingProject()

    expect(uploadPhotos).toHaveBeenCalledWith(PROJECT_ID, [
      { key: '00000000-0000-4000-8000-000000000001', file: front },
    ])
    expect(onClose).toHaveBeenCalledOnce()
  })

  test('stays open with the fields locked when some photos fail', async () => {
    const failedKey = '00000000-0000-4000-8000-000000000001'
    uploadPhotos.mockResolvedValue({ failedKeys: [failedKey] })
    render(<ProjectFormModal onClose={onClose} />)

    pickPhotos(makeImage('front.jpg'))
    fillName('Garden')
    clickSave()
    await finishCreatingProject()

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeEnabled()
  })

  test('retries a failed photo into the same project', async () => {
    const failedKey = '00000000-0000-4000-8000-000000000001'
    uploadPhotos.mockResolvedValue({ failedKeys: [failedKey] })
    const { rerender } = render(<ProjectFormModal onClose={onClose} />)

    const front = makeImage('front.jpg')
    pickPhotos(front)
    fillName('Garden')
    clickSave()
    await finishCreatingProject()

    mockUploadPhotos({ uploadStates: { [failedKey]: { status: 'failed', errorMessage: 'Couldn\'t upload "front.jpg".', photo: null } } })
    rerender(<ProjectFormModal onClose={onClose} />)

    expect(screen.getByText('Couldn\'t upload "front.jpg".')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent("Some photos didn't upload")

    fireEvent.click(screen.getByRole('button', { name: 'Retry front.jpg' }))

    expect(uploadPhotos).toHaveBeenLastCalledWith(PROJECT_ID, [{ key: failedKey, file: front }])
    expect(mutate).toHaveBeenCalledOnce()
  })

  test("can't be closed while photos are uploading", () => {
    mockUploadPhotos({ isUploading: true })

    render(<ProjectFormModal onClose={onClose} />)

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })
})
