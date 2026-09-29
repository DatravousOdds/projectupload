import { beforeEach, describe, expect, test, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import { createProject, listProjects } from './projects'

// Swap the real client for a fake so tests never reach Supabase.
vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn() } }))

type FromResult = ReturnType<typeof supabase.from>

const projectRow: Tables<'projects'> = {
  id: '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b',
  name: 'Garden',
  description: null,
  created_at: '2026-09-29T12:00:00+00:00',
  updated_at: '2026-09-29T12:00:00+00:00',
}

const olderProjectRow: Tables<'projects'> = {
  id: '0a9b8c7d-6e5f-4a3b-9c1d-2e3f4a5b6c7d',
  name: 'Kitchen remodel',
  description: 'Before and after',
  created_at: '2026-09-20T09:30:00+00:00',
  updated_at: '2026-09-25T18:15:00+00:00',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('createProject', () => {
  // Fake the chain: from('projects').insert(...).select().single()
  const single = vi.fn()
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))

  beforeEach(() => {
    vi.mocked(supabase.from).mockReturnValue({ insert } as unknown as FromResult)
  })

  test('inserts the project and returns the new row', async () => {
    single.mockResolvedValue({ data: projectRow, error: null })

    const project = await createProject({ name: 'Garden', description: null })

    expect(project).toEqual(projectRow)
    expect(supabase.from).toHaveBeenCalledWith('projects')
    expect(insert).toHaveBeenCalledWith({ name: 'Garden', description: null })
  })

  test('throws the Supabase error when the insert fails', async () => {
    const supabaseError = new Error('new row violates check constraint "projects_name_check"')
    single.mockResolvedValue({ data: null, error: supabaseError })

    await expect(createProject({ name: 'Garden', description: null })).rejects.toBe(supabaseError)
  })
})

describe('listProjects', () => {
  // Fake the chain: from('projects').select(...).is(...).order(...)
  const order = vi.fn()
  const is = vi.fn(() => ({ order }))
  const select = vi.fn(() => ({ is }))

  beforeEach(() => {
    vi.mocked(supabase.from).mockReturnValue({ select } as unknown as FromResult)
  })

  test('returns each project with its photo count, in the order Supabase sends them', async () => {
    order.mockResolvedValue({
      data: [
        { ...projectRow, photos: [{ count: 3 }] },
        { ...olderProjectRow, photos: [{ count: 0 }] },
      ],
      error: null,
    })

    const projects = await listProjects()

    expect(projects).toEqual([
      { ...projectRow, photoCount: 3 },
      { ...olderProjectRow, photoCount: 0 },
    ])
  })

  test('counts only visible photos, newest-updated project first', async () => {
    order.mockResolvedValue({ data: [], error: null })

    await listProjects()

    expect(supabase.from).toHaveBeenCalledWith('projects')
    expect(select).toHaveBeenCalledWith('*, photos(count)')
    expect(is).toHaveBeenCalledWith('photos.deleted_at', null)
    expect(order).toHaveBeenCalledWith('updated_at', { ascending: false })
  })

  test('returns an empty list when there are no projects', async () => {
    order.mockResolvedValue({ data: [], error: null })

    await expect(listProjects()).resolves.toEqual([])
  })

  test('throws the Supabase error when the query fails', async () => {
    const supabaseError = new Error('permission denied for table projects')
    order.mockResolvedValue({ data: null, error: supabaseError })

    await expect(listProjects()).rejects.toBe(supabaseError)
  })
})
