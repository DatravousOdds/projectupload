import type { ProjectInput } from '../lib/validation'
import type { Tables } from '../types/database'
import { supabase } from '../lib/supabase'

export async function createProject(input: ProjectInput): Promise<Tables<'projects'>> {
  const { data, error } = await supabase
    .from('projects')
    .insert(input)
    .select()
    .single()

  if (error) throw error

  return data
}

export type ProjectWithPhotoCount = Tables<'projects'> & { photoCount: number }

// Every project column plus a count of its photos; pair with the deleted_at filter below.
const PROJECT_WITH_PHOTO_COUNT = '*, photos(count)'

type ProjectRowWithPhotos = Tables<'projects'> & { photos: { count: number }[] }

// Supabase nests the count as photos: [{ count }]; flatten it for the UI.
function withPhotoCount({ photos, ...project }: ProjectRowWithPhotos): ProjectWithPhotoCount {
  return { ...project, photoCount: photos[0]?.count ?? 0 }
}

export type CoverPhoto = Pick<Tables<'photos'>, 'storage_path' | 'thumb_path' | 'updated_at'>

export type ProjectListItem = ProjectWithPhotoCount & { coverPhoto: CoverPhoto | null }

// Also embeds the project's newest visible photo as `cover`, so the list needs one request.
const PROJECT_LIST_ITEM = `${PROJECT_WITH_PHOTO_COUNT}, cover:photos(storage_path, thumb_path, updated_at)`

export async function listProjects(): Promise<ProjectListItem[]> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_LIST_ITEM)
    .is('photos.deleted_at', null)
    .is('cover.deleted_at', null)
    .order('created_at', { referencedTable: 'cover', ascending: false })
    .limit(1, { referencedTable: 'cover' })
    .order('updated_at', { ascending: false })

  if (error) throw error

  return data.map(({ cover, ...project }) => ({
    ...withPhotoCount(project),
    coverPhoto: cover[0] ?? null,
  }))
}

// Returns null when no project has this id, so the page can show not-found instead of an error.
export async function getProject(id: string): Promise<ProjectWithPhotoCount | null> {
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_WITH_PHOTO_COUNT)
    .is('photos.deleted_at', null)
    .eq('id', id)
    .maybeSingle()

  if (error) throw error

  return data ? withPhotoCount(data) : null
}
