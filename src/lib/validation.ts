import type { TablesInsert } from '../types/database'

// Match the check constraints on the projects table.
export const MAX_PROJECT_NAME_LENGTH = 100
export const MAX_PROJECT_DESCRIPTION_LENGTH = 1000

export type ProjectInput = Pick<TablesInsert<'projects'>, 'name' | 'description'>

export type ProjectFormValues = { name: string; description: string }

export type ProjectInputErrors = Partial<Record<keyof ProjectFormValues, string>>

export type ProjectInputResult =
  | { isValid: true; project: ProjectInput }
  | { isValid: false; errors: ProjectInputErrors }

// Count code points, not UTF-16 units, so emoji count once like Postgres char_length.
function characterCount(text: string): number {
  return [...text].length
}

export function validateProjectInput(values: ProjectFormValues): ProjectInputResult {
  const name = values.name.trim()
  const description = values.description.trim()
  const errors: ProjectInputErrors = {}

  if (name === '') { 
    errors.name = 'Name is required.'
  } else if (characterCount(name) > MAX_PROJECT_NAME_LENGTH) {
    errors.name = `Name must be ${MAX_PROJECT_NAME_LENGTH} characters or fewer.`
  }

  if (characterCount(description) > MAX_PROJECT_DESCRIPTION_LENGTH) {
    errors.description = `Description must be ${MAX_PROJECT_DESCRIPTION_LENGTH} characters or fewer.`
  }

  if (errors.name || errors.description) {
    return { isValid: false, errors }
  }

  return { isValid: true, project: { name, description: description || null } }
}

// Match the photos Storage bucket's limits, so files are rejected before any processing or upload.
export const MAX_PHOTO_SIZE_BYTES = 15 * 1024 * 1024

export const ALLOWED_PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']

// Returns a message to show the user, or null when the file can be uploaded.
export function getPhotoFileError(file: File): string | null {
  if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type)) {
    return `"${file.name}" isn't a supported image. Use JPEG, PNG, WebP, GIF or HEIC.`
  }

  if (file.size > MAX_PHOTO_SIZE_BYTES) {
    return `"${file.name}" is larger than 15 MB.`
  }

  return null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Checks a route :id before querying, so malformed URLs go straight to not-found.
export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value)
}
