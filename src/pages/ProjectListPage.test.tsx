import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Photo } from '../api/photos'
import type { ProjectListItem } from '../api/projects'
import { useCreateProject, useProjects } from '../hooks/useProjects'
import { useUploadPhotos } from '../hooks/useUploadPhotos'
import { ProjectListPage } from './ProjectListPage'

// The page is tested against fake hooks; the real hooks and api have their own coverage.
vi.mock('../hooks/useProjects', () => ({ useProjects: vi.fn(), useCreateProject: vi.fn() }))
vi.mock('../hooks/useUploadPhotos', () => ({ useUploadPhotos: vi.fn() }))
vi.mock('../api/photos', () => ({
  getPhotoUrl: (photo: Pick<Photo, 'thumb_path'>, variant: string) => `${variant}:${photo.thumb_path}`,
}))

type ProjectsResult = ReturnType<typeof useProjects>

const refetch = vi.fn()

const gardenProject: ProjectListItem = {
  id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  name: 'Garden',
  description: null,
  created_at: '2026-09-29T12:00:00+00:00',
  updated_at: '2026-09-29T12:00:00+00:00',
  photoCount: 1,
  coverPhoto: {
    storage_path: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/photo-9',
    thumb_path: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b/photo-9_thumb',
    updated_at: '2026-09-29T12:00:00+00:00',
  },
}

const kitchenProject: ProjectListItem = {
  id: '0a9b8c7d-6e5f-4a3b-9c1d-2e3f4a5b6c7d',
  name: 'Kitchen remodel',
  description: 'Before and after',
  created_at: '2026-09-20T09:30:00+00:00',
  updated_at: '2026-09-25T18:15:00+00:00',
  photoCount: 4,
  coverPhoto: null,
}

function mockProjects(state: Partial<ProjectsResult>) {
  vi.mocked(useProjects).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch,
    ...state,
  } as unknown as ProjectsResult)
}

// ProjectCard renders <Link>, which needs a router around it.
function renderPage() {
  render(
    <MemoryRouter>
      <ProjectListPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useCreateProject).mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useCreateProject>)
  vi.mocked(useUploadPhotos).mockReturnValue({
    uploadPhotos: vi.fn(),
    uploadStates: {},
    isUploading: false,
  })
})

describe('ProjectListPage', () => {
  test('shows placeholders while projects load', () => {
    mockProjects({ isPending: true })

    renderPage()

    expect(screen.getByText('Loading projects…')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  test('shows an error with a retry button when loading fails', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockProjects({ isError: true, error: new Error('network down') })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load projects.")
    expect(refetch).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalled()

    consoleError.mockRestore()
  })

  test('shows an empty state when there are no projects', () => {
    mockProjects({ data: [] })

    renderPage()

    expect(screen.getByText('No projects yet')).toBeInTheDocument()
  })

  test('shows a card linking to each project', () => {
    mockProjects({ data: [gardenProject, kitchenProject] })

    renderPage()

    expect(screen.getByRole('link', { name: /Garden/ })).toHaveAttribute('href', `/projects/${gardenProject.id}`)
    expect(screen.getByRole('link', { name: /Kitchen remodel/ })).toHaveAttribute('href', `/projects/${kitchenProject.id}`)
    expect(screen.getByText('1 photo')).toBeInTheDocument()
    expect(screen.getByText('4 photos')).toBeInTheDocument()
  })

  test("shows each project's newest photo as its cover, or a placeholder without one", () => {
    mockProjects({ data: [gardenProject, kitchenProject] })

    renderPage()

    const gardenCover = screen.getByRole('link', { name: /Garden/ }).querySelector('img')
    expect(gardenCover).toHaveAttribute('src', `thumb:${gardenProject.coverPhoto?.thumb_path}`)
    expect(screen.getByRole('link', { name: /Kitchen remodel/ }).querySelector('img')).toBeNull()
  })

  test('always shows the public notice', () => {
    mockProjects({ data: [] })

    renderPage()

    expect(screen.getByText('Projects and photos here are public.')).toBeInTheDocument()
  })

  test('opens the new project form', () => {
    mockProjects({ data: [] })

    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'New project' }))

    expect(screen.getByRole('dialog', { name: 'New project' })).toBeInTheDocument()
  })
})
