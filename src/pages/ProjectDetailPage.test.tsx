import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { ProjectWithPhotoCount } from '../api/projects'
import { useProject } from '../hooks/useProject'
import { useUploadPhotos } from '../hooks/useUploadPhotos'
import type { UploadState } from '../hooks/useUploadPhotos'
import { ProjectDetailPage } from './ProjectDetailPage'

// The page is tested against fake hooks; the real hooks and api have their own coverage.
vi.mock('../hooks/useProject', () => ({ useProject: vi.fn() }))
vi.mock('../hooks/useUploadPhotos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useUploadPhotos')>()),
  useUploadPhotos: vi.fn(),
}))

type ProjectResult = ReturnType<typeof useProject>

const PROJECT_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const UPLOAD_KEY = '00000000-0000-4000-8000-000000000001'

const refetch = vi.fn()
const uploadPhotos = vi.fn()

const gardenProject: ProjectWithPhotoCount = {
  id: PROJECT_ID,
  name: 'Garden',
  description: 'Spring beds',
  created_at: '2026-09-29T12:00:00+00:00',
  updated_at: '2026-09-29T12:00:00+00:00',
  photoCount: 0,
}

function mockProject(state: Partial<ProjectResult>) {
  vi.mocked(useProject).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch,
    ...state,
  } as unknown as ProjectResult)
}

function mockUploads(state: { uploadStates?: Record<string, UploadState>; isUploading?: boolean } = {}) {
  vi.mocked(useUploadPhotos).mockReturnValue({
    uploadPhotos,
    uploadStates: state.uploadStates ?? {},
    isUploading: state.isUploading ?? false,
  })
}

function renderPage(path = `/projects/${PROJECT_ID}`) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function pickPhotos(...files: File[]) {
  fireEvent.change(screen.getByLabelText('Choose photos to upload'), { target: { files } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUploads()
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(UPLOAD_KEY)
})

describe('ProjectDetailPage', () => {
  test('shows not-found for an id that is not a UUID', () => {
    mockProject({ isPending: true })

    renderPage('/projects/not-a-uuid')

    expect(screen.getByRole('heading', { name: 'Project not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to projects' })).toHaveAttribute('href', '/')
  })

  test('shows not-found when no project has that id', () => {
    mockProject({ data: null })

    renderPage()

    expect(screen.getByRole('heading', { name: 'Project not found' })).toBeInTheDocument()
  })

  test('shows a placeholder while the project loads', () => {
    mockProject({ isPending: true })

    renderPage()

    expect(screen.getByText('Loading project…')).toBeInTheDocument()
  })

  test('shows an error with a retry button when loading fails', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockProject({ isError: true, error: new Error('network down') })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this project.")
    expect(refetch).toHaveBeenCalledOnce()

    consoleError.mockRestore()
  })

  test('shows the project details and an empty state when it has no photos', () => {
    mockProject({ data: gardenProject })

    renderPage()

    expect(screen.getByRole('heading', { name: 'Garden' })).toBeInTheDocument()
    expect(screen.getByText('Spring beds')).toBeInTheDocument()
    expect(screen.getByText(/0 photos/)).toBeInTheDocument()
    expect(screen.getByText('No photos yet')).toBeInTheDocument()
  })

  test('hides the empty state once the project has photos', () => {
    mockProject({ data: { ...gardenProject, photoCount: 1 } })

    renderPage()

    expect(screen.getByText(/1 photo$/)).toBeInTheDocument()
    expect(screen.queryByText('No photos yet')).not.toBeInTheDocument()
  })

  test('uploads picked photos into this project and lists them', () => {
    mockProject({ data: gardenProject })
    renderPage()

    const photo = new File(['x'], 'front.jpg', { type: 'image/jpeg' })
    pickPhotos(photo)

    expect(uploadPhotos).toHaveBeenCalledWith(PROJECT_ID, [{ key: UPLOAD_KEY, file: photo }])
    expect(screen.getByRole('list', { name: 'Uploads' })).toHaveTextContent('front.jpg')
  })

  test('rejects unsupported files without uploading them', () => {
    mockProject({ data: gardenProject })
    renderPage()

    pickPhotos(new File(['x'], 'notes.pdf', { type: 'application/pdf' }))

    expect(screen.getByRole('alert')).toHaveTextContent('"notes.pdf" isn\'t a supported image.')
    expect(uploadPhotos).not.toHaveBeenCalled()
  })

  test('shows each upload status and retries a failed photo', () => {
    mockProject({ data: gardenProject })
    const { rerender } = renderPage()

    const photo = new File(['x'], 'front.jpg', { type: 'image/jpeg' })
    pickPhotos(photo)

    mockUploads({ uploadStates: { [UPLOAD_KEY]: { status: 'failed', errorMessage: 'Couldn\'t upload "front.jpg".' } } })
    rerender(
      <MemoryRouter initialEntries={[`/projects/${PROJECT_ID}`]}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Retry front.jpg' }))

    expect(screen.getByText('Couldn\'t upload "front.jpg".')).toBeInTheDocument()
    expect(uploadPhotos).toHaveBeenLastCalledWith(PROJECT_ID, [{ key: UPLOAD_KEY, file: photo }])
  })

  test('disables the upload button while photos are uploading', () => {
    mockProject({ data: gardenProject })
    mockUploads({ isUploading: true })

    renderPage()

    expect(screen.getByRole('button', { name: 'Upload photos' })).toBeDisabled()
  })
})
