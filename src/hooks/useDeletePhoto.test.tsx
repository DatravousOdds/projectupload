import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { deletePhoto } from '../api/photos'
import type { Photo } from '../api/photos'
import { useDeletePhoto } from './useDeletePhoto'

// deletePhoto has its own tests; here it's faked to control success and failure.
vi.mock('../api/photos', () => ({ deletePhoto: vi.fn() }))

const PROJECT_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const PHOTOS_KEY = ['photos', PROJECT_ID]

// Only the fields the hook reads matter here.
const garden = { id: 'photo-1', project_id: PROJECT_ID, file_name: 'garden.jpg' } as Photo
const kitchen = { id: 'photo-2', project_id: PROJECT_ID, file_name: 'kitchen.jpg' } as Photo

let queryClient: QueryClient

function renderDeleteHook() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return renderHook(() => useDeletePhoto(), { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient()
  queryClient.setQueryData(PHOTOS_KEY, [garden, kitchen])
  vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useDeletePhoto', () => {
  test('removes the photo from the grid before the delete finishes', async () => {
    let finishDelete: () => void = () => {}
    vi.mocked(deletePhoto).mockReturnValue(new Promise((resolve) => (finishDelete = () => resolve())))
    const { result } = renderDeleteHook()

    act(() => result.current.mutate(garden))

    await waitFor(() => expect(queryClient.getQueryData(PHOTOS_KEY)).toEqual([kitchen]))
    expect(deletePhoto).toHaveBeenCalledWith('photo-1')

    await act(async () => finishDelete())
  })

  test('refreshes the photos, the project, and the project list once done', async () => {
    vi.mocked(deletePhoto).mockResolvedValue()
    const { result } = renderDeleteHook()

    await act(() => result.current.mutateAsync(garden))

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: PHOTOS_KEY })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['project', PROJECT_ID] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] })
  })

  test('puts the photo back and reports the error when the delete fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(deletePhoto).mockRejectedValue(new Error('network down'))
    const { result } = renderDeleteHook()

    act(() => result.current.mutate(garden))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData(PHOTOS_KEY)).toEqual([garden, kitchen])
    expect(console.error).toHaveBeenCalledWith('Failed to delete garden.jpg:', expect.any(Error))
  })
})
