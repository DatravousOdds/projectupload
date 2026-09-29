import { describe, expect, test } from 'vitest'
import {
  MAX_PROJECT_DESCRIPTION_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
  validateProjectInput,
} from './validation'

describe('validateProjectInput', () => {
  test('returns trimmed values for valid input', () => {
    const result = validateProjectInput({ name: '  Kitchen remodel  ', description: '  Before and after  ' })

    expect(result).toEqual({
      isValid: true,
      project: { name: 'Kitchen remodel', description: 'Before and after' },
    })
  })

  test('turns a blank description into null', () => {
    const result = validateProjectInput({ name: 'Garden', description: '   ' })

    expect(result).toEqual({ isValid: true, project: { name: 'Garden', description: null } })
  })

  test('rejects a missing name', () => {
    const result = validateProjectInput({ name: '', description: '' })

    expect(result).toEqual({ isValid: false, errors: { name: 'Name is required.' } })
  })

  test('rejects a whitespace-only name', () => {
    const result = validateProjectInput({ name: '    ', description: '' })

    expect(result).toEqual({ isValid: false, errors: { name: 'Name is required.' } })
  })

  test('accepts a name at the length limit', () => {
    const name = 'a'.repeat(MAX_PROJECT_NAME_LENGTH)

    expect(validateProjectInput({ name, description: '' }).isValid).toBe(true)
  })

  test('rejects a name over the length limit', () => {
    const name = 'a'.repeat(MAX_PROJECT_NAME_LENGTH + 1)

    expect(validateProjectInput({ name, description: '' })).toEqual({
      isValid: false,
      errors: { name: 'Name must be 100 characters or fewer.' },
    })
  })

  test('counts emoji as one character, like Postgres char_length', () => {
    const name = '📷'.repeat(MAX_PROJECT_NAME_LENGTH)

    expect(validateProjectInput({ name, description: '' }).isValid).toBe(true)
  })

  test('rejects a description over the length limit', () => {
    const description = 'a'.repeat(MAX_PROJECT_DESCRIPTION_LENGTH + 1)

    expect(validateProjectInput({ name: 'Garden', description })).toEqual({
      isValid: false,
      errors: { description: 'Description must be 1000 characters or fewer.' },
    })
  })

  test('reports name and description errors together', () => {
    const description = 'a'.repeat(MAX_PROJECT_DESCRIPTION_LENGTH + 1)

    expect(validateProjectInput({ name: '', description })).toEqual({
      isValid: false,
      errors: {
        name: 'Name is required.',
        description: 'Description must be 1000 characters or fewer.',
      },
    })
  })
})
