// Display formatting shared by cards, the detail page, and the viewer.

// Uses the viewer's own locale, e.g. "Sep 29, 2026" or "29 Sept 2026".
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, { dateStyle: 'medium' })
}

const BYTES_PER_KB = 1024
const BYTES_PER_MB = 1024 * 1024

export function formatFileSize(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} B`
  if (bytes < BYTES_PER_MB) return `${Number((bytes / BYTES_PER_KB).toFixed(1))} KB`
  return `${Number((bytes / BYTES_PER_MB).toFixed(1))} MB`
}

export function formatPhotoCount(count: number): string {
  return count === 1 ? '1 photo' : `${count} photos`
}
