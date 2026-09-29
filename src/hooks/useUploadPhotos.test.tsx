import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { uploadPhoto } from '../api/photos'
import type { Photo } from '../api/photos'
import { useUploadPhotos } from './useUploadPhotos'

// uploadPhoto has its own tests; here it's faked to control timing and failures.
vi.mock('../api/photos', () => ({ uploadPhoto: vi.fn() }))

const PROJECT_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'

function makeUploads(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    key: `photo-${index}`,
    file: new File(['x'], `photo-${index}.jpg`, { type: 'image/jpeg' }),
  }))
}

let queryClient: QueryClient

function renderUploadHook() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return renderHook(() => useUploadPhotos(), { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient()
  vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
  vi.mocked(uploadPhoto).mockResolvedValue({} as Photo)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useUploadPhotos', () => {
  test('uploads every photo into the project and marks each done', async () => {
    const uploads = makeUploads(2)
    const { result } = renderUploadHook()

    let outcome: { failedKeys: string[] } | undefined
    await act(async () => {
      outcome = await result.current.uploadPhotos(PROJECT_ID, uploads)
    })

    expect(uploadPhoto).toHaveBeenCalledWith(PROJECT_ID, uploads[0].file)
    expect(uploadPhoto).toHaveBeenCalledWith(PROJECT_ID, uploads[1].file)
    expect(outcome).toEqual({ failedKeys: [] })
    expect(result.current.uploadStates).toEqual({
      'photo-0': { status: 'done', errorMessage: null },
      'photo-1': { status: 'done', errorMessage: null },
    })
    expect(result.current.isUploading).toBe(false)
  })

  test('refreshes the photo grid, the project, and the project list afterwards', async () => {
    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.uploadPhotos(PROJECT_ID, makeUploads(1))
    })

    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['photos', PROJECT_ID] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['project', PROJECT_ID] })
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] })
  })

  test('never uploads more than 3 photos at once', async () => {
    let activeCount = 0
    let maxActiveCount = 0
    vi.mocked(uploadPhoto).mockImplementation(async () => {
      activeCount += 1
      maxActiveCount = Math.max(maxActiveCount, activeCount)
      await new Promise((resolve) => setTimeout(resolve, 0))
      activeCount -= 1
      return {} as Photo
    })
    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.uploadPhotos(PROJECT_ID, makeUploads(7))
    })

    expect(uploadPhoto).toHaveBeenCalledTimes(7)
    expect(maxActiveCount).toBe(3)
  })

  test('shows which photos are uploading and which are waiting', async () => {
    let finishUploads: () => void = () => {}
    const uploadsCanFinish = new Promise<void>((resolve) => {
      finishUploads = resolve
    })
    vi.mocked(uploadPhoto).mockImplementation(async () => {
      await uploadsCanFinish
      return {} as Photo
    })
    const { result } = renderUploadHook()

    let uploading: Promise<unknown> = Promise.resolve()
    act(() => {
      uploading = result.current.uploadPhotos(PROJECT_ID, makeUploads(4))
    })

    await waitFor(() => expect(result.current.uploadStates['photo-0']?.status).toBe('uploading'))
    expect(result.current.uploadStates['photo-2']?.status).toBe('uploading')
    expect(result.current.uploadStates['photo-3']?.status).toBe('waiting')
    expect(result.current.isUploading).toBe(true)

    await act(async () => {
      finishUploads()
      await uploading
    })
    expect(result.current.isUploading).toBe(false)
  })

  test('marks a failed photo, keeps uploading the rest, and reports it', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(uploadPhoto).mockRejectedValueOnce(new Error('network down'))
    const { result } = renderUploadHook()

    let outcome: { failedKeys: string[] } | undefined
    await act(async () => {
      outcome = await result.current.uploadPhotos(PROJECT_ID, makeUploads(2))
    })

    expect(outcome).toEqual({ failedKeys: ['photo-0'] })
    expect(result.current.uploadStates).toEqual({
      'photo-0': { status: 'failed', errorMessage: 'Couldn\'t upload "photo-0.jpg".' },
      'photo-1': { status: 'done', errorMessage: null },
    })
    expect(consoleError).toHaveBeenCalled()
  })

  test('retries a failed photo by uploading it again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(uploadPhoto).mockRejectedValueOnce(new Error('network down'))
    const [upload] = makeUploads(1)
    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.uploadPhotos(PROJECT_ID, [upload])
    })
    await act(async () => {
      await result.current.uploadPhotos(PROJECT_ID, [upload])
    })

    expect(result.current.uploadStates['photo-0']).toEqual({ status: 'done', errorMessage: null })
  })

  test('skips the refresh when nothing uploaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(uploadPhoto).mockRejectedValue(new Error('network down'))
    const { result } = renderUploadHook()

    await act(async () => {
      await result.current.uploadPhotos(PROJECT_ID, makeUploads(2))
    })

    expect(queryClient.invalidateQueries).not.toHaveBeenCalled()
  })
})
