import { useMutation, useQueryClient } from '@tanstack/react-query'
import { deletePhoto } from '../api/photos'
import type { Photo } from '../api/photos'

// Takes the whole photo, so the grid's query key comes from its project_id.
export function useDeletePhoto() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (photo: Photo) => deletePhoto(photo.id),

    // Hide the photo right away; the saved list is kept so a failure can put it back.
    onMutate: async (photo) => {
      const photosKey = ['photos', photo.project_id]
      await queryClient.cancelQueries({ queryKey: photosKey })

      const previousPhotos = queryClient.getQueryData<Photo[]>(photosKey)
      queryClient.setQueryData<Photo[]>(photosKey, (photos) => photos?.filter(({ id }) => id !== photo.id))

      return { previousPhotos }
    },

    onError: (error, photo, context) => {
      console.error(`Failed to delete ${photo.file_name}:`, error)
      queryClient.setQueryData(['photos', photo.project_id], context?.previousPhotos)
    },

    onSettled: (_data, _error, photo) => {
      queryClient.invalidateQueries({ queryKey: ['photos', photo.project_id] })
      queryClient.invalidateQueries({ queryKey: ['project', photo.project_id] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
}
