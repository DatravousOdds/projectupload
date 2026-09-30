import { describe, expect, test } from 'vitest'
import {
  MAX_PHOTO_SIZE_BYTES,
  MAX_PROJECT_DESCRIPTION_LENGTH,
  MAX_PROJECT_NAME_LENGTH,
  getPhotoFileError,
  isValidUuid,
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

describe('getPhotoFileError', () => {
  // Only size and type matter to validation, so fake the size instead of allocating megabytes.
  function makeFile(name: string, type: string, sizeBytes = 1024): File {
    const file = new File(['x'], name, { type })
    Object.defineProperty(file, 'size', { value: sizeBytes })
    return file
  }

  test.each(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'])('accepts %s', (type) => {
    expect(getPhotoFileError(makeFile('photo', type))).toBeNull()
  })

  test('rejects a file that is not a supported image', () => {
    expect(getPhotoFileError(makeFile('notes.pdf', 'application/pdf'))).toBe(
      '"notes.pdf" isn\'t a supported image. Use JPEG, PNG, WebP, GIF or HEIC.',
    )
  })

  test('rejects an image type the bucket does not allow', () => {
    expect(getPhotoFileError(makeFile('icon.svg', 'image/svg+xml'))).toBe(
      '"icon.svg" isn\'t a supported image. Use JPEG, PNG, WebP, GIF or HEIC.',
    )
  })

  test('rejects a file the browser could not identify', () => {
    expect(getPhotoFileError(makeFile('mystery', ''))).toBe(
      '"mystery" isn\'t a supported image. Use JPEG, PNG, WebP, GIF or HEIC.',
    )
  })

  test('accepts a file exactly at the size limit', () => {
    expect(getPhotoFileError(makeFile('big.jpg', 'image/jpeg', MAX_PHOTO_SIZE_BYTES))).toBeNull()
  })

  test('rejects a file over the size limit', () => {
    expect(getPhotoFileError(makeFile('huge.jpg', 'image/jpeg', MAX_PHOTO_SIZE_BYTES + 1))).toBe(
      '"huge.jpg" is larger than 15 MB.',
    )
  })

  test('reports the type problem first when both checks fail', () => {
    expect(getPhotoFileError(makeFile('huge.pdf', 'application/pdf', MAX_PHOTO_SIZE_BYTES + 1))).toBe(
      '"huge.pdf" isn\'t a supported image. Use JPEG, PNG, WebP, GIF or HEIC.',
    )
  })
})

describe('isValidUuid', () => {
  test('accepts a UUID', () => {
    expect(isValidUuid('6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b')).toBe(true)
  })

  test('accepts uppercase hex digits', () => {
    expect(isValidUuid('6F1C2A3B-4D5E-4F60-8A7B-9C0D1E2F3A4B')).toBe(true)
  })

  test.each(['', '123', 'not-a-uuid', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4', '6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4bz'])(
    'rejects %j',
    (value) => {
      expect(isValidUuid(value)).toBe(false)
    },
  )
})
