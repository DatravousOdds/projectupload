import type { TablesInsert } from '../types/database'

// Match the check constraints on the projects table.
export const MAX_PROJECT_NAME_LENGTH = 100
export const MAX_PROJECT_DESCRIPTION_LENGTH = 1000

type ProjectInput = Pick<TablesInsert<'projects'>, 'name' | 'description'>

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
