import { processPhoto } from '../lib/images'
import { supabase } from '../lib/supabase'
import type { Tables } from '../types/database'

export type Photo = Tables<'photos'>

export type PhotoVariant = 'original' | 'thumb'

const PHOTOS_BUCKET = 'photos'

// Storage handles at most 1,000 files per list or remove request.
const STORAGE_BATCH_SIZE = 1000

// Short browser cache as a backup; the ?v= version in getPhotoUrl is what makes replacements show at once.
const UPLOAD_CACHE_SECONDS = '60'

async function uploadFile(path: string, blob: Blob, contentType: string): Promise<void> {
  const { error } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, blob, { contentType, cacheControl: UPLOAD_CACHE_SECONDS })

  if (error) throw error
}

function logOrphanedFiles(paths: string[]) {
  console.error('Orphaned photo files; delete them in the Supabase dashboard:', paths)
}

// Only called after the rows are gone: the delete already happened for the user, so leftovers are logged, not thrown.
async function removeFiles(paths: string[]): Promise<void> {
  const { data, error } = await supabase.storage.from(PHOTOS_BUCKET).remove(paths)

  // Storage reports policy-blocked removals as fewer removed files, not as an error.
  if (error || data.length < paths.length) logOrphanedFiles(paths)
}

async function listProjectFilePaths(projectId: string): Promise<string[]> {
  const paths: string[] = []

  for (let offset = 0; ; offset += STORAGE_BATCH_SIZE) {
    const { data, error } = await supabase.storage
      .from(PHOTOS_BUCKET)
      .list(projectId, { limit: STORAGE_BATCH_SIZE, offset })

    if (error) throw error

    paths.push(...data.map(({ name }) => `${projectId}/${name}`))
    if (data.length < STORAGE_BATCH_SIZE) return paths
  }
}

// Lists the folder rather than using photo rows, which are already gone; this also clears orphans from failed uploads.
export async function removeProjectFiles(projectId: string): Promise<void> {
  let paths: string[]

  try {
    paths = await listProjectFilePaths(projectId)
  } catch (error) {
    console.error(`Couldn't list the deleted project's files; delete the folder ${projectId}/ in the Supabase dashboard:`, error)
    return
  }

  for (let start = 0; start < paths.length; start += STORAGE_BATCH_SIZE) {
    await removeFiles(paths.slice(start, start + STORAGE_BATCH_SIZE))
  }
}

// Processes, uploads both files, then saves the row. See SPEC.md → Photo flows → Upload.
export async function uploadPhoto(projectId: string, file: File): Promise<Photo> {
  const processed = await processPhoto(file)

  // The id is generated here so the files can be uploaded to their final paths before the row exists.
  const photoId = crypto.randomUUID()
  const storagePath = `${projectId}/${photoId}`
  const thumbPath = `${storagePath}_thumb`

  await uploadFile(storagePath, processed.original.blob, processed.original.mimeType)

  try {
    await uploadFile(thumbPath, processed.thumbnail.blob, processed.thumbnail.mimeType)
  } catch (error) {
    logOrphanedFiles([storagePath])
    throw error
  }

  const { data, error } = await supabase
    .from('photos')
    .insert({
      id: photoId,
      project_id: projectId,
      storage_path: storagePath,
      thumb_path: thumbPath,
      file_name: file.name,
      mime_type: processed.original.mimeType,
      size_bytes: processed.original.blob.size,
      width: processed.width,
      height: processed.height,
    })
    .select()
    .single()

  if (error) {
    logOrphanedFiles([storagePath, thumbPath])
    throw error
  }

  return data
}

export async function listPhotos(projectId: string): Promise<Photo[]> {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error

  return data
}

// Permanent: the row goes first, so a failure can only leave unseen files, never a row with missing images.
export async function deletePhoto(photoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('photos')
    .delete()
    .eq('id', photoId)
    .select('storage_path, thumb_path')
    .single()

  if (error) throw error

  await removeFiles([data.storage_path, data.thumb_path])
}

// The only place image URLs are built. updated_at changes on replace, so the new file isn't served from cache.
export function getPhotoUrl(
  photo: Pick<Photo, 'storage_path' | 'thumb_path' | 'updated_at'>,
  variant: PhotoVariant,
): string {
  const path = variant === 'original' ? photo.storage_path : photo.thumb_path
  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path)
  const version = Math.floor(Date.parse(photo.updated_at) / 1000)

  return `${data.publicUrl}?v=${version}`
}
