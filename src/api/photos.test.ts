import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { processPhoto } from '../lib/images'
import type { ProcessedPhoto } from '../lib/images'
import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'
import { getPhotoUrl, listPhotos, uploadPhoto } from './photos'

// Swap the real client for a fake so tests never reach Supabase.
vi.mock('../lib/supabase', () => ({ supabase: { from: vi.fn(), storage: { from: vi.fn() } } }))

// Image processing has its own tests; here it just returns fixed blobs.
vi.mock('../lib/images', () => ({ processPhoto: vi.fn() }))

type FromResult = ReturnType<typeof supabase.from>
type StorageBucket = ReturnType<typeof supabase.storage.from>

const PROJECT_ID = '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b'
const PHOTO_ID = '11111111-2222-4333-8444-555555555555'
const STORAGE_PATH = `${PROJECT_ID}/${PHOTO_ID}`
const THUMB_PATH = `${PROJECT_ID}/${PHOTO_ID}_thumb`

const photoRow: Tables<'photos'> = {
  id: PHOTO_ID,
  project_id: PROJECT_ID,
  storage_path: STORAGE_PATH,
  thumb_path: THUMB_PATH,
  file_name: 'garden.jpg',
  mime_type: 'image/webp',
  size_bytes: 500,
  width: 2560,
  height: 1920,
  caption: null,
  created_at: '2026-09-29T12:00:00+00:00',
  updated_at: '2026-09-29T12:00:00+00:00',
  deleted_at: null,
}

describe('uploadPhoto', () => {
  const file = new File(['original'], 'garden.jpg', { type: 'image/jpeg' })
  const compressedBlob = new Blob([new Uint8Array(500)], { type: 'image/webp' })
  const thumbnailBlob = new Blob([new Uint8Array(50)], { type: 'image/webp' })

  const processed: ProcessedPhoto = {
    original: { blob: compressedBlob, mimeType: 'image/webp' },
    thumbnail: { blob: thumbnailBlob, mimeType: 'image/webp' },
    width: 2560,
    height: 1920,
  }

  // Fake the Storage call: storage.from('photos').upload(...)
  const upload = vi.fn()

  // Fake the row insert: from('photos').insert(...).select().single()
  const single = vi.fn()
  const select = vi.fn(() => ({ single }))
  const insert = vi.fn(() => ({ select }))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(PHOTO_ID)
    vi.mocked(processPhoto).mockResolvedValue(processed)
    vi.mocked(supabase.storage.from).mockReturnValue({ upload } as unknown as StorageBucket)
    vi.mocked(supabase.from).mockReturnValue({ insert } as unknown as FromResult)
    upload.mockResolvedValue({ data: {}, error: null })
    single.mockResolvedValue({ data: photoRow, error: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('uploads both files to the project paths, then saves the row', async () => {
    const photo = await uploadPhoto(PROJECT_ID, file)

    expect(processPhoto).toHaveBeenCalledWith(file)
    expect(supabase.storage.from).toHaveBeenCalledWith('photos')
    expect(upload).toHaveBeenNthCalledWith(1, STORAGE_PATH, compressedBlob, {
      contentType: 'image/webp',
      cacheControl: '60',
    })
    expect(upload).toHaveBeenNthCalledWith(2, THUMB_PATH, thumbnailBlob, {
      contentType: 'image/webp',
      cacheControl: '60',
    })
    expect(supabase.from).toHaveBeenCalledWith('photos')
    expect(insert).toHaveBeenCalledWith({
      id: PHOTO_ID,
      project_id: PROJECT_ID,
      storage_path: STORAGE_PATH,
      thumb_path: THUMB_PATH,
      file_name: 'garden.jpg',
      mime_type: 'image/webp',
      size_bytes: 500,
      width: 2560,
      height: 1920,
    })
    expect(photo).toEqual(photoRow)
  })

  test('throws before saving anything else when the original fails to upload', async () => {
    const storageError = new Error('The object exceeded the maximum allowed size')
    upload.mockResolvedValueOnce({ data: null, error: storageError })

    await expect(uploadPhoto(PROJECT_ID, file)).rejects.toBe(storageError)
    expect(upload).toHaveBeenCalledOnce()
    expect(insert).not.toHaveBeenCalled()
  })

  test('logs the orphaned original when the thumbnail fails to upload', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const storageError = new Error('network down')
    upload.mockResolvedValueOnce({ data: {}, error: null }).mockResolvedValueOnce({ data: null, error: storageError })

    await expect(uploadPhoto(PROJECT_ID, file)).rejects.toBe(storageError)
    expect(insert).not.toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Orphaned'), [STORAGE_PATH])
  })

  test('logs both orphaned files when saving the row fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const databaseError = new Error('new row violates row-level security policy')
    single.mockResolvedValue({ data: null, error: databaseError })

    await expect(uploadPhoto(PROJECT_ID, file)).rejects.toBe(databaseError)
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Orphaned'), [STORAGE_PATH, THUMB_PATH])
  })

  test('throws when the photo cannot be processed', async () => {
    const processingError = new Error("Couldn't encode the image.")
    vi.mocked(processPhoto).mockRejectedValue(processingError)

    await expect(uploadPhoto(PROJECT_ID, file)).rejects.toBe(processingError)
    expect(upload).not.toHaveBeenCalled()
  })
})

describe('getPhotoUrl', () => {
  const getPublicUrl = vi.fn((path: string) => ({
    data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/photos/${path}` },
  }))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.storage.from).mockReturnValue({ getPublicUrl } as unknown as StorageBucket)
  })

  test('builds the original URL with a version from updated_at', () => {
    const url = getPhotoUrl(photoRow, 'original')

    expect(supabase.storage.from).toHaveBeenCalledWith('photos')
    expect(getPublicUrl).toHaveBeenCalledWith(STORAGE_PATH)
    expect(url).toBe(`https://example.supabase.co/storage/v1/object/public/photos/${STORAGE_PATH}?v=1790683200`)
  })

  test('builds the thumbnail URL from thumb_path', () => {
    getPhotoUrl(photoRow, 'thumb')

    expect(getPublicUrl).toHaveBeenCalledWith(THUMB_PATH)
  })

  test('changes the URL when the photo is replaced', () => {
    const replaced = { ...photoRow, updated_at: '2026-09-29T12:05:12+00:00' }

    expect(getPhotoUrl(replaced, 'thumb')).not.toBe(getPhotoUrl(photoRow, 'thumb'))
    expect(getPhotoUrl(replaced, 'thumb')).toMatch(/\?v=1790683512$/)
  })
})

describe('listPhotos', () => {
  // Fake the chain: from('photos').select('*').eq(...).is(...).order(...)
  const order = vi.fn()
  const is = vi.fn(() => ({ order }))
  const eq = vi.fn(() => ({ is }))
  const select = vi.fn(() => ({ eq }))

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(supabase.from).mockReturnValue({ select } as unknown as FromResult)
  })

  test("returns the project's visible photos, newest first", async () => {
    order.mockResolvedValue({ data: [photoRow], error: null })

    const photos = await listPhotos(PROJECT_ID)

    expect(photos).toEqual([photoRow])
    expect(supabase.from).toHaveBeenCalledWith('photos')
    expect(select).toHaveBeenCalledWith('*')
    expect(eq).toHaveBeenCalledWith('project_id', PROJECT_ID)
    expect(is).toHaveBeenCalledWith('deleted_at', null)
    expect(order).toHaveBeenCalledWith('created_at', { ascending: false })
  })

  test('throws the Supabase error when the query fails', async () => {
    const supabaseError = new Error('network down')
    order.mockResolvedValue({ data: null, error: supabaseError })

    await expect(listPhotos(PROJECT_ID)).rejects.toBe(supabaseError)
  })
})
