import { describe, expect, test } from 'vitest'
import { formatDate, formatFileSize, formatPhotoCount } from './format'

describe('formatDate', () => {
  test('formats an ISO timestamp as a medium date', () => {
    expect(formatDate('2026-09-29T12:00:00+00:00')).toBe(
      new Date('2026-09-29T12:00:00+00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }),
    )
  })
})

describe('formatFileSize', () => {
  test.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [1024 * 1024, '1 MB'],
    [2.25 * 1024 * 1024, '2.3 MB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected)
  })
})

describe('formatPhotoCount', () => {
  test.each([
    [0, '0 photos'],
    [1, '1 photo'],
    [12, '12 photos'],
  ])('formats %i as %s', (count, expected) => {
    expect(formatPhotoCount(count)).toBe(expected)
  })
})
