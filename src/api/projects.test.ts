import { beforeEach, describe, expect, test, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import { createProject, getProject, listProjects } from './projects'

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
  // A chainable fake: every query method returns the same object, and awaiting it gives `result`.
  type FakeQuery = Record<'select' | 'order' | 'limit', ReturnType<typeof vi.fn>> & {
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise<unknown>
  }

  let query: FakeQuery
  let result: { data: unknown; error: unknown }

  const coverPhoto = {
    storage_path: `${projectRow.id}/photo-9`,
    thumb_path: `${projectRow.id}/photo-9_thumb`,
    updated_at: '2026-09-29T13:00:00+00:00',
  }

  beforeEach(() => {
    result = { data: [], error: null }
    const chain = () => query
    query = {
      select: vi.fn(chain),
      order: vi.fn(chain),
      limit: vi.fn(chain),
      then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    }
    vi.mocked(supabase.from).mockReturnValue(query as unknown as FromResult)
  })

  test('returns each project with its photo count and cover, in the order Supabase sends them', async () => {
    result = {
      data: [
        { ...projectRow, photos: [{ count: 3 }], cover: [coverPhoto] },
        { ...olderProjectRow, photos: [{ count: 0 }], cover: [] },
      ],
      error: null,
    }

    const projects = await listProjects()

    expect(projects).toEqual([
      { ...projectRow, photoCount: 3, coverPhoto },
      { ...olderProjectRow, photoCount: 0, coverPhoto: null },
    ])
  })

  test('counts photos and sorts newest-updated project first', async () => {
    await listProjects()

    expect(supabase.from).toHaveBeenCalledWith('projects')
    expect(query.select).toHaveBeenCalledWith('*, photos(count), cover:photos(storage_path, thumb_path, updated_at)')
    expect(query.order).toHaveBeenCalledWith('updated_at', { ascending: false })
  })

  test("uses each project's newest photo as its cover", async () => {
    await listProjects()

    expect(query.order).toHaveBeenCalledWith('created_at', { referencedTable: 'cover', ascending: false })
    expect(query.limit).toHaveBeenCalledWith(1, { referencedTable: 'cover' })
  })

  test('returns an empty list when there are no projects', async () => {
    await expect(listProjects()).resolves.toEqual([])
  })

  test('throws the Supabase error when the query fails', async () => {
    const supabaseError = new Error('permission denied for table projects')
    result = { data: null, error: supabaseError }

    await expect(listProjects()).rejects.toBe(supabaseError)
  })
})

describe('getProject', () => {
  // Fake the chain: from('projects').select(...).eq(...).maybeSingle()
  const maybeSingle = vi.fn()
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))

  beforeEach(() => {
    vi.mocked(supabase.from).mockReturnValue({ select } as unknown as FromResult)
  })

  test('returns the project with its photo count', async () => {
    maybeSingle.mockResolvedValue({ data: { ...projectRow, photos: [{ count: 2 }] }, error: null })

    const project = await getProject(projectRow.id)

    expect(project).toEqual({ ...projectRow, photoCount: 2 })
    expect(supabase.from).toHaveBeenCalledWith('projects')
    expect(select).toHaveBeenCalledWith('*, photos(count)')
    expect(eq).toHaveBeenCalledWith('id', projectRow.id)
  })

  test('returns null when no project has that id', async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null })

    await expect(getProject(projectRow.id)).resolves.toBeNull()
  })

  test('throws the Supabase error when the query fails', async () => {
    const supabaseError = new Error('network down')
    maybeSingle.mockResolvedValue({ data: null, error: supabaseError })

    await expect(getProject(projectRow.id)).rejects.toBe(supabaseError)
  })
})
