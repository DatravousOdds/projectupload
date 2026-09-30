import { skipToken, useQuery } from '@tanstack/react-query'
import { getProject } from '../api/projects'
import { isValidUuid } from '../lib/validation'

// skipToken: an invalid id never reaches Supabase; the page shows not-found for it.
export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: id && isValidUuid(id) ? () => getProject(id) : skipToken,
  })
}
