import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Photo } from '../api/photos'
import { PhotoGrid } from './PhotoGrid'

// URL building has its own tests; a readable fake keeps assertions simple.
vi.mock('../api/photos', () => ({
  getPhotoUrl: (photo: Photo, variant: string) => `${variant}:${photo.id}`,
}))

const onOpen = vi.fn()
const onRetry = vi.fn()

function makePhoto(id: string, fileName: string): Photo {
  return {
    id,
    project_id: 'project-1',
    storage_path: `project-1/${id}`,
    thumb_path: `project-1/${id}_thumb`,
    file_name: fileName,
    mime_type: 'image/webp',
    size_bytes: 500,
    width: 800,
    height: 600,
    caption: null,
    created_at: '2026-09-29T12:00:00+00:00',
    updated_at: '2026-09-29T12:00:00+00:00',
    deleted_at: null,
  }
}

const garden = makePhoto('photo-1', 'garden.jpg')
const kitchen = makePhoto('photo-2', 'kitchen.jpg')

function renderGrid(props: Partial<Parameters<typeof PhotoGrid>[0]> = {}) {
  render(
    <PhotoGrid
      photos={[garden, kitchen]}
      pendingUploads={[]}
      uploadStates={{}}
      canRetry
      onOpen={onOpen}
      onRetry={onRetry}
      {...props}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PhotoGrid', () => {
  test('shows a lazily loaded thumbnail for each photo, in the order given', () => {
    renderGrid()

    const buttons = screen.getAllByRole('button', { name: /^Open / })
    expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual(['Open garden.jpg', 'Open kitchen.jpg'])

    const thumbnail = buttons[0].querySelector('img')
    expect(thumbnail).toHaveAttribute('src', 'thumb:photo-1')
    expect(thumbnail).toHaveAttribute('loading', 'lazy')
  })

  test('opens the viewer for the clicked photo', () => {
    renderGrid()

    fireEvent.click(screen.getByRole('button', { name: 'Open kitchen.jpg' }))

    expect(onOpen).toHaveBeenCalledWith('photo-2')
  })

  test('shows a placeholder when the browser cannot display a thumbnail', () => {
    renderGrid()

    const thumbnail = screen.getByRole('button', { name: 'Open garden.jpg' }).querySelector('img')
    fireEvent.error(thumbnail!)

    expect(screen.getByText('Preview not available in this browser')).toBeInTheDocument()
  })

  test('shows uploading photos first, with their status', () => {
    const upload = { key: 'upload-1', file: new File(['x'], 'new.jpg', { type: 'image/jpeg' }) }

    renderGrid({
      pendingUploads: [upload],
      uploadStates: { 'upload-1': { status: 'uploading', errorMessage: null, photo: null } },
    })

    const tiles = screen.getAllByRole('listitem')
    expect(tiles[0]).toHaveTextContent('new.jpg')
    expect(tiles[0]).toHaveTextContent('Uploading…')
  })

  test('offers Retry on a failed upload', () => {
    const upload = { key: 'upload-1', file: new File(['x'], 'new.jpg', { type: 'image/jpeg' }) }

    renderGrid({
      pendingUploads: [upload],
      uploadStates: { 'upload-1': { status: 'failed', errorMessage: 'Couldn\'t upload "new.jpg".', photo: null } },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Retry new.jpg' }))

    expect(screen.getByText('Couldn\'t upload "new.jpg".')).toBeInTheDocument()
    expect(onRetry).toHaveBeenCalledWith(upload)
  })

  test('hides Retry while other photos are uploading', () => {
    const upload = { key: 'upload-1', file: new File(['x'], 'new.jpg', { type: 'image/jpeg' }) }

    renderGrid({
      pendingUploads: [upload],
      uploadStates: { 'upload-1': { status: 'failed', errorMessage: 'Couldn\'t upload "new.jpg".', photo: null } },
      canRetry: false,
    })

    expect(screen.queryByRole('button', { name: 'Retry new.jpg' })).not.toBeInTheDocument()
  })
})
