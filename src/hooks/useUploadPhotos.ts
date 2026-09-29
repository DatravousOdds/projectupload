import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { uploadPhoto } from '../api/photos'

// Decoding a large photo takes tens of MB, so only a few are processed at once.
const UPLOAD_BATCH_SIZE = 3

export type UploadStatus = 'waiting' | 'uploading' | 'done' | 'failed'

export type UploadState = { status: UploadStatus; errorMessage: string | null }

// `key` is the caller's id for the photo, so its status can be shown next to it.
export type PhotoUpload = { key: string; file: File }

// Tracks each photo separately; one useMutation only tracks its latest call, so it can't show per-photo status.
export function useUploadPhotos() {
  const queryClient = useQueryClient()
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({})

  const isUploading = Object.values(uploadStates).some(
    ({ status }) => status === 'waiting' || status === 'uploading',
  )

  function setUploadState(key: string, uploadState: UploadState) {
    setUploadStates((previous) => ({ ...previous, [key]: uploadState }))
  }

  async function uploadOne(projectId: string, { key, file }: PhotoUpload): Promise<boolean> {
    setUploadState(key, { status: 'uploading', errorMessage: null })

    try {
      await uploadPhoto(projectId, file)
      setUploadState(key, { status: 'done', errorMessage: null })
      return true
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error)
      setUploadState(key, { status: 'failed', errorMessage: `Couldn't upload "${file.name}".` })
      return false
    }
  }

  // Also used to retry: pass just the failed photos again.
  async function uploadPhotos(projectId: string, uploads: PhotoUpload[]): Promise<{ failedKeys: string[] }> {
    setUploadStates((previous) => {
      const next = { ...previous }
      for (const { key } of uploads) next[key] = { status: 'waiting', errorMessage: null }
      return next
    })

    const failedKeys: string[] = []

    for (let start = 0; start < uploads.length; start += UPLOAD_BATCH_SIZE) {
      const batch = uploads.slice(start, start + UPLOAD_BATCH_SIZE)
      const results = await Promise.all(batch.map((upload) => uploadOne(projectId, upload)))

      results.forEach((isUploaded, index) => {
        if (!isUploaded) failedKeys.push(batch[index].key)
      })
    }

    if (failedKeys.length < uploads.length) {
      queryClient.invalidateQueries({ queryKey: ['photos', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    }

    return { failedKeys }
  }

  return { uploadStates, uploadPhotos, isUploading }
}
