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

export async function listProjects(): Promise<ProjectWithPhotoCount[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*, photos(count)')
    .is('photos.deleted_at', null)
    .order('updated_at', { ascending: false })

  if (error) throw error

  // Supabase nests the count as photos: [{ count }]; flatten it for the UI.
  return data.map(({ photos, ...project }) => ({
    ...project,
    photoCount: photos[0]?.count ?? 0,
  }))
}
