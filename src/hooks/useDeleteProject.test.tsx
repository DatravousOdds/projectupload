import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { deleteProject } from '../api/projects'
import { useDeleteProject } from './useDeleteProject'

// deleteProject has its own tests; here it's faked to control success and failure.
vi.mock('../api/projects', () => ({ deleteProject: vi.fn() }))

const PROJECT_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'

let queryClient: QueryClient

function renderDeleteHook() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )

  return renderHook(() => useDeleteProject(), { wrapper })
}

beforeEach(() => {
  vi.clearAllMocks()
  queryClient = new QueryClient()
  queryClient.setQueryData(['project', PROJECT_ID], { id: PROJECT_ID })
  queryClient.setQueryData(['photos', PROJECT_ID], [])
  vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useDeleteProject', () => {
  test("deletes the project, drops its cached data, and refreshes the project list", async () => {
    vi.mocked(deleteProject).mockResolvedValue()
    const { result } = renderDeleteHook()

    await act(() => result.current.mutateAsync(PROJECT_ID))

    expect(deleteProject).toHaveBeenCalledWith(PROJECT_ID)
    expect(queryClient.getQueryData(['project', PROJECT_ID])).toBeUndefined()
    expect(queryClient.getQueryData(['photos', PROJECT_ID])).toBeUndefined()
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects'] })
  })

  test('keeps the cached project and reports the error when the delete fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(deleteProject).mockRejectedValue(new Error('network down'))
    const { result } = renderDeleteHook()

    act(() => result.current.mutate(PROJECT_ID))

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(queryClient.getQueryData(['project', PROJECT_ID])).toEqual({ id: PROJECT_ID })
    expect(console.error).toHaveBeenCalledWith(`Failed to delete project ${PROJECT_ID}:`, expect.any(Error))
  })
})
