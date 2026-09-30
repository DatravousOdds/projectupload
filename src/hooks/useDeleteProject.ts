import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deleteProject } from '../api/projects'

// Not optimistic: the page leaves on success, and a whole project shouldn't vanish before the server agrees.
export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (projectId: string) => deleteProject(projectId),

    // Dropped rather than refetched, so going Back never shows the deleted project from cache.
    onSuccess: (_data, projectId) => {
      queryClient.removeQueries({ queryKey: ['project', projectId] })
      queryClient.removeQueries({ queryKey: ['photos', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },

    onError: (error, projectId) => {
      console.error(`Failed to delete project ${projectId}:`, error)
    },
  })
}
