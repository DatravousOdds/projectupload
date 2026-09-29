// See SPEC.md → Photo flows → Upload.
export const MAX_ORIGINAL_EDGE_PX = 2560
export const THUMBNAIL_EDGE_PX = 400

const ORIGINAL_QUALITY = 0.82
const THUMBNAIL_QUALITY = 0.75

export type EncodedImage = { blob: Blob; mimeType: string }

export type ProcessedPhoto = {
  original: EncodedImage
  thumbnail: EncodedImage
  width: number | null
  height: number | null
}

export function fitWithin(width: number, height: number, maxEdge: number): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height))

  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function encodeWebp(bitmap: ImageBitmap, maxEdge: number, quality: number): Promise<Blob> {
  const size = fitWithin(bitmap.width, bitmap.height, maxEdge)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, size.width, size.height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't encode the image."))),
      'image/webp',
      quality,
    )
  })
}

// Decodes once, then makes the compressed original and the thumbnail from the same bitmap.
export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  const originalFile: EncodedImage = { blob: file, mimeType: file.type }

  let bitmap: ImageBitmap
  try {
    // Applies EXIF orientation, so sideways phone photos come out upright.
    bitmap = await createImageBitmap(file)
  } catch {
    // e.g. HEIC outside Safari: upload the file untouched; the grid shows a placeholder where it can't display.
    return { original: originalFile, thumbnail: originalFile, width: null, height: null }
  }

  try {
    // GIFs are kept as-is: re-encoding would keep only the first frame.
    const isGif = file.type === 'image/gif'
    const compressedBlob = isGif ? null : await encodeWebp(bitmap, MAX_ORIGINAL_EDGE_PX, ORIGINAL_QUALITY)
    const thumbnailBlob = await encodeWebp(bitmap, THUMBNAIL_EDGE_PX, THUMBNAIL_QUALITY)

    const isCompressedSmaller = compressedBlob !== null && compressedBlob.size < file.size
    const size = isCompressedSmaller
      ? fitWithin(bitmap.width, bitmap.height, MAX_ORIGINAL_EDGE_PX)
      : { width: bitmap.width, height: bitmap.height }

    return {
      // blob.type, not 'image/webp': browsers that can't encode WebP return PNG instead.
      original: isCompressedSmaller ? { blob: compressedBlob, mimeType: compressedBlob.type } : originalFile,
      thumbnail: { blob: thumbnailBlob, mimeType: thumbnailBlob.type },
      width: size.width,
      height: size.height,
    }
  } finally {
    bitmap.close()
  }
}
