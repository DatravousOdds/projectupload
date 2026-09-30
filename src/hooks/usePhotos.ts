import { skipToken, useQuery } from '@tanstack/react-query'
import { listPhotos } from '../api/photos'
import { isValidUuid } from '../lib/validation'

// Same key useUploadPhotos refreshes, so finished uploads appear without extra wiring.
export function usePhotos(projectId: string | undefined) {
  return useQuery({
    queryKey: ['photos', projectId],
    queryFn: projectId && isValidUuid(projectId) ? () => listPhotos(projectId) : skipToken,
  })
}
