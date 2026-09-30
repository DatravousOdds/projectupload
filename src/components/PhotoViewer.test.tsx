import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { Photo } from '../api/photos'
import { PhotoViewer } from './PhotoViewer'

vi.mock('../api/photos', () => ({
  getPhotoUrl: (photo: Photo, variant: string) => `${variant}:${photo.id}`,
}))

const onNavigate = vi.fn()
const onClose = vi.fn()
const onDelete = vi.fn()

function makePhoto(id: string, fileName: string, overrides: Partial<Photo> = {}): Photo {
  return {
    id,
    project_id: 'project-1',
    storage_path: `project-1/${id}`,
    thumb_path: `project-1/${id}_thumb`,
    file_name: fileName,
    mime_type: 'image/webp',
    size_bytes: 1536,
    width: 2560,
    height: 1920,
    caption: null,
    created_at: '2026-09-29T12:00:00+00:00',
    updated_at: '2026-09-29T12:00:00+00:00',
    ...overrides,
  }
}

const photos = [makePhoto('photo-1', 'first.jpg'), makePhoto('photo-2', 'second.jpg'), makePhoto('photo-3', 'third.jpg')]

function renderViewer(photoId: string, viewerPhotos = photos) {
  render(
    <PhotoViewer
      photos={viewerPhotos}
      photoId={photoId}
      onNavigate={onNavigate}
      onClose={onClose}
      onDelete={onDelete}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PhotoViewer', () => {
  test('shows the full-size photo and its details', () => {
    renderViewer('photo-2')

    expect(screen.getByRole('img', { name: 'second.jpg' })).toHaveAttribute('src', 'original:photo-2')
    expect(screen.getByText('2 of 3')).toBeInTheDocument()
    expect(screen.getByText('2560 × 1920 · 1.5 KB')).toBeInTheDocument()
    expect(screen.queryByText('Replaced')).not.toBeInTheDocument()
  })

  test('shows when a photo was replaced', () => {
    renderViewer('photo-1', [makePhoto('photo-1', 'first.jpg', { updated_at: '2026-10-02T08:00:00+00:00' })])

    expect(screen.getByText('Replaced')).toBeInTheDocument()
  })

  test('leaves out dimensions the browser could not read', () => {
    renderViewer('photo-1', [makePhoto('photo-1', 'IMG_0042.heic', { width: null, height: null })])

    expect(screen.getByText('1.5 KB')).toBeInTheDocument()
  })

  test('moves to the previous and next photos with the buttons', () => {
    renderViewer('photo-2')

    fireEvent.click(screen.getByRole('button', { name: 'Previous photo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next photo' }))

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'photo-1')
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'photo-3')
  })

  test('moves with the arrow keys', () => {
    renderViewer('photo-2')
    const viewer = screen.getByRole('dialog')

    fireEvent.keyDown(viewer, { key: 'ArrowLeft' })
    fireEvent.keyDown(viewer, { key: 'ArrowRight' })

    expect(onNavigate).toHaveBeenNthCalledWith(1, 'photo-1')
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'photo-3')
  })

  test('stops at the first and last photos', () => {
    renderViewer('photo-1')

    expect(screen.getByRole('button', { name: 'Previous photo' })).toBeDisabled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' })
    expect(onNavigate).not.toHaveBeenCalled()
  })

  test('closes with the Close button', () => {
    renderViewer('photo-1')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  test('asks to delete the photo being shown', () => {
    renderViewer('photo-2')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledWith(photos[1])
  })

  test('shows a placeholder when the browser cannot display the photo', () => {
    renderViewer('photo-1')

    fireEvent.error(screen.getByRole('img', { name: 'first.jpg' }))

    expect(screen.getByText('Preview not available in this browser')).toBeInTheDocument()
  })
})
