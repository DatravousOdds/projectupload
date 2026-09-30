import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Photo } from '../api/photos'
import type { ProjectWithPhotoCount } from '../api/projects'
import { useDeletePhoto } from '../hooks/useDeletePhoto'
import { usePhotos } from '../hooks/usePhotos'
import { useProject } from '../hooks/useProject'
import { useUploadPhotos } from '../hooks/useUploadPhotos'
import type { UploadState } from '../hooks/useUploadPhotos'
import { ProjectDetailPage } from './ProjectDetailPage'

// The page is tested against fake hooks; the real hooks and api have their own coverage.
vi.mock('../hooks/useProject', () => ({ useProject: vi.fn() }))
vi.mock('../hooks/usePhotos', () => ({ usePhotos: vi.fn() }))
vi.mock('../hooks/useDeletePhoto', () => ({ useDeletePhoto: vi.fn() }))
vi.mock('../hooks/useUploadPhotos', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useUploadPhotos')>()),
  useUploadPhotos: vi.fn(),
}))
vi.mock('../api/photos', () => ({
  getPhotoUrl: (photo: Photo, variant: string) => `${variant}:${photo.id}`,
}))

type ProjectResult = ReturnType<typeof useProject>
type PhotosResult = ReturnType<typeof usePhotos>
type DeleteResult = ReturnType<typeof useDeletePhoto>

const PROJECT_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const UPLOAD_KEY = '00000000-0000-4000-8000-000000000001'

const refetchProject = vi.fn()
const refetchPhotos = vi.fn()
const uploadPhotos = vi.fn()
const deletePhoto = vi.fn()

const gardenProject: ProjectWithPhotoCount = {
  id: PROJECT_ID,
  name: 'Garden',
  description: 'Spring beds',
  created_at: '2026-09-29T12:00:00+00:00',
  updated_at: '2026-09-29T12:00:00+00:00',
  photoCount: 0,
}

function makePhoto(id: string, fileName: string): Photo {
  return {
    id,
    project_id: PROJECT_ID,
    storage_path: `${PROJECT_ID}/${id}`,
    thumb_path: `${PROJECT_ID}/${id}_thumb`,
    file_name: fileName,
    mime_type: 'image/webp',
    size_bytes: 500,
    width: 800,
    height: 600,
    caption: null,
    created_at: '2026-09-29T12:00:00+00:00',
    updated_at: '2026-09-29T12:00:00+00:00',
  }
}

function mockProject(state: Partial<ProjectResult>) {
  vi.mocked(useProject).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: refetchProject,
    ...state,
  } as unknown as ProjectResult)
}

function mockPhotos(state: Partial<PhotosResult>) {
  vi.mocked(usePhotos).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: refetchPhotos,
    ...state,
  } as unknown as PhotosResult)
}

function mockUploads(state: { uploadStates?: Record<string, UploadState>; isUploading?: boolean } = {}) {
  vi.mocked(useUploadPhotos).mockReturnValue({
    uploadPhotos,
    uploadStates: state.uploadStates ?? {},
    isUploading: state.isUploading ?? false,
  })
}

function mockDelete(state: Partial<DeleteResult> = {}) {
  vi.mocked(useDeletePhoto).mockReturnValue({ mutate: deletePhoto, isError: false, ...state } as unknown as DeleteResult)
}

function pageAt(path: string) {
  return (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>
  )
}

function renderPage(path = `/projects/${PROJECT_ID}`) {
  return render(pageAt(path))
}

function pickPhotos(...files: File[]) {
  fireEvent.change(screen.getByLabelText('Choose photos to upload'), { target: { files } })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockProject({ data: gardenProject })
  mockPhotos({ data: [] })
  mockUploads()
  mockDelete()
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(UPLOAD_KEY)
})

describe('ProjectDetailPage: the project', () => {
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

  test('shows an error with a retry button when the project fails to load', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockProject({ isError: true, error: new Error('network down') })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load this project.")
    expect(refetchProject).toHaveBeenCalledOnce()
  })

  test('shows the project details', () => {
    mockProject({ data: { ...gardenProject, photoCount: 2 } })

    renderPage()

    expect(screen.getByRole('heading', { name: 'Garden' })).toBeInTheDocument()
    expect(screen.getByText('Spring beds')).toBeInTheDocument()
    expect(screen.getByText(/2 photos/)).toBeInTheDocument()
  })
})

describe('ProjectDetailPage: photos', () => {
  test('shows an empty state when the project has no photos', () => {
    renderPage()

    expect(screen.getByText('No photos yet')).toBeInTheDocument()
  })

  test('shows placeholders while photos load', () => {
    mockPhotos({ isPending: true })

    renderPage()

    expect(screen.getByText('Loading photos…')).toBeInTheDocument()
  })

  test('shows an error with a retry button when photos fail to load', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockPhotos({ isError: true, error: new Error('network down') })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the photos.")
    expect(refetchPhotos).toHaveBeenCalledOnce()
  })

  test('shows the current photos in the grid', () => {
    mockPhotos({ data: [makePhoto('photo-2', 'newer.jpg'), makePhoto('photo-1', 'older.jpg')] })

    renderPage()

    const buttons = screen.getAllByRole('button', { name: /^Open / })
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Open newer.jpg', 'Open older.jpg'])
    expect(screen.queryByText('No photos yet')).not.toBeInTheDocument()
  })

  test('opens the viewer for a photo and closes it again', () => {
    mockPhotos({ data: [makePhoto('photo-2', 'newer.jpg'), makePhoto('photo-1', 'older.jpg')] })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Open older.jpg' }))

    const viewer = screen.getByRole('dialog')
    expect(within(viewer).getByRole('img', { name: 'older.jpg' })).toHaveAttribute('src', 'original:photo-1')
    expect(within(viewer).getByText('2 of 2')).toBeInTheDocument()

    fireEvent.click(within(viewer).getByRole('button', { name: 'Previous photo' }))
    expect(within(screen.getByRole('dialog')).getByRole('img', { name: 'newer.jpg' })).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('ProjectDetailPage: uploading', () => {
  test('uploads picked photos into this project and shows them in the grid while uploading', () => {
    renderPage()

    const photo = new File(['x'], 'front.jpg', { type: 'image/jpeg' })
    pickPhotos(photo)

    expect(uploadPhotos).toHaveBeenCalledWith(PROJECT_ID, [{ key: UPLOAD_KEY, file: photo }])
    expect(screen.queryByText('No photos yet')).not.toBeInTheDocument()
    expect(screen.getByText('front.jpg')).toBeInTheDocument()
  })

  test('rejects unsupported files without uploading them', () => {
    renderPage()

    pickPhotos(new File(['x'], 'notes.pdf', { type: 'application/pdf' }))

    expect(screen.getByRole('alert')).toHaveTextContent('"notes.pdf" isn\'t a supported image.')
    expect(uploadPhotos).not.toHaveBeenCalled()
  })

  test('shows a finished upload as a photo at the front, before the list refreshes', () => {
    mockPhotos({ data: [makePhoto('photo-1', 'older.jpg')] })
    const { rerender } = renderPage()

    pickPhotos(new File(['x'], 'front.jpg', { type: 'image/jpeg' }))
    mockUploads({
      uploadStates: { [UPLOAD_KEY]: { status: 'done', errorMessage: null, photo: makePhoto('photo-9', 'front.jpg') } },
    })
    rerender(pageAt(`/projects/${PROJECT_ID}`))

    const buttons = screen.getAllByRole('button', { name: /^Open / })
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Open front.jpg', 'Open older.jpg'])
  })

  test('does not show a finished upload twice once the list has refreshed', () => {
    const uploaded = makePhoto('photo-9', 'front.jpg')
    const { rerender } = renderPage()

    pickPhotos(new File(['x'], 'front.jpg', { type: 'image/jpeg' }))
    mockUploads({ uploadStates: { [UPLOAD_KEY]: { status: 'done', errorMessage: null, photo: uploaded } } })
    mockPhotos({ data: [uploaded] })
    rerender(pageAt(`/projects/${PROJECT_ID}`))

    expect(screen.getAllByRole('button', { name: 'Open front.jpg' })).toHaveLength(1)
  })

  test('retries a failed upload into this project', () => {
    const { rerender } = renderPage()

    const photo = new File(['x'], 'front.jpg', { type: 'image/jpeg' })
    pickPhotos(photo)
    mockUploads({
      uploadStates: { [UPLOAD_KEY]: { status: 'failed', errorMessage: 'Couldn\'t upload "front.jpg".', photo: null } },
    })
    rerender(pageAt(`/projects/${PROJECT_ID}`))
    fireEvent.click(screen.getByRole('button', { name: 'Retry front.jpg' }))

    expect(uploadPhotos).toHaveBeenLastCalledWith(PROJECT_ID, [{ key: UPLOAD_KEY, file: photo }])
  })

  test('disables the upload button while photos are uploading', () => {
    mockUploads({ isUploading: true })

    renderPage()

    expect(screen.getByRole('button', { name: 'Upload photos' })).toBeDisabled()
  })
})

describe('ProjectDetailPage: deleting', () => {
  const DELETE_MESSAGE = "Delete this photo? This can't be undone."

  // Named, because the viewer's own Delete button is also on screen.
  function confirmDelete() {
    const confirmDialog = screen.getByRole('dialog', { name: DELETE_MESSAGE })
    fireEvent.click(within(confirmDialog).getByRole('button', { name: 'Delete' }))
  }

  const newer = makePhoto('photo-2', 'newer.jpg')
  const older = makePhoto('photo-1', 'older.jpg')

  beforeEach(() => {
    mockPhotos({ data: [newer, older] })
  })

  test('asks for confirmation before deleting from the grid', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Delete older.jpg' }))

    expect(screen.getByRole('dialog', { name: DELETE_MESSAGE })).toBeInTheDocument()
    expect(deletePhoto).not.toHaveBeenCalled()

    confirmDelete()

    expect(deletePhoto).toHaveBeenCalledWith(older)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('keeps the photo when the confirmation is cancelled', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Delete older.jpg' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(deletePhoto).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('moves the viewer to the next photo after deleting', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Open newer.jpg' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    confirmDelete()

    expect(deletePhoto).toHaveBeenCalledWith(newer)
    expect(within(screen.getByRole('dialog')).getByRole('img', { name: 'older.jpg' })).toBeInTheDocument()
  })

  test('moves the viewer back to the previous photo when the last one is deleted', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Open older.jpg' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    confirmDelete()

    expect(within(screen.getByRole('dialog')).getByRole('img', { name: 'newer.jpg' })).toBeInTheDocument()
  })

  test('closes the viewer after deleting the only photo', () => {
    mockPhotos({ data: [older] })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Open older.jpg' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    confirmDelete()

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('does not bring back a photo uploaded on this visit once it is deleted', () => {
    const uploaded = makePhoto('photo-9', 'front.jpg')
    mockPhotos({ data: [] })
    const { rerender } = renderPage()

    pickPhotos(new File(['x'], 'front.jpg', { type: 'image/jpeg' }))
    mockUploads({ uploadStates: { [UPLOAD_KEY]: { status: 'done', errorMessage: null, photo: uploaded } } })
    rerender(pageAt(`/projects/${PROJECT_ID}`))

    fireEvent.click(screen.getByRole('button', { name: 'Delete front.jpg' }))
    confirmDelete()

    expect(deletePhoto).toHaveBeenCalledWith(uploaded)
    expect(screen.queryByRole('button', { name: 'Open front.jpg' })).not.toBeInTheDocument()
  })

  test('shows an error when a delete fails', () => {
    mockDelete({ isError: true, variables: older } as Partial<DeleteResult>)

    renderPage()

    expect(screen.getByRole('alert')).toHaveTextContent('Couldn\'t delete "older.jpg".')
  })
})
