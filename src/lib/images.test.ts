import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fitWithin, processPhoto } from './images'

describe('fitWithin', () => {
  test('shrinks a landscape image so its width is the limit', () => {
    expect(fitWithin(4000, 3000, 2560)).toEqual({ width: 2560, height: 1920 })
  })

  test('shrinks a portrait image so its height is the limit', () => {
    expect(fitWithin(3000, 4000, 400)).toEqual({ width: 300, height: 400 })
  })

  test('never enlarges a small image', () => {
    expect(fitWithin(800, 600, 2560)).toEqual({ width: 800, height: 600 })
  })

  test('rounds to whole pixels', () => {
    expect(fitWithin(1000, 333, 400)).toEqual({ width: 400, height: 133 })
  })
})

describe('processPhoto', () => {
  // jsdom has no image decoding or canvas encoding, so both are faked.
  type FakeCanvas = { width: number; height: number; drawImage: ReturnType<typeof vi.fn> }

  let canvases: FakeCanvas[]
  let encodedBlobs: Blob[]
  const close = vi.fn()

  function stubDecodedImage(width: number, height: number) {
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width, height, close }))
  }

  function makeFile(name: string, type: string, sizeBytes: number): File {
    return new File([new Uint8Array(sizeBytes)], name, { type })
  }

  beforeEach(() => {
    canvases = []
    encodedBlobs = []
    close.mockClear()

    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName !== 'canvas') return createElement(tagName)

      const canvas: FakeCanvas = { width: 0, height: 0, drawImage: vi.fn() }
      canvases.push(canvas)

      return {
        get width() { return canvas.width },
        set width(value: number) { canvas.width = value },
        get height() { return canvas.height },
        set height(value: number) { canvas.height = value },
        getContext: () => ({ drawImage: canvas.drawImage }),
        toBlob: (callback: BlobCallback) => callback(encodedBlobs.shift() ?? null),
      } as unknown as HTMLCanvasElement
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  test('compresses a large photo and makes a thumbnail from the same decode', async () => {
    stubDecodedImage(4000, 3000)
    const compressed = new Blob([new Uint8Array(500)], { type: 'image/webp' })
    const thumbnail = new Blob([new Uint8Array(50)], { type: 'image/webp' })
    encodedBlobs.push(compressed, thumbnail)

    const result = await processPhoto(makeFile('garden.jpg', 'image/jpeg', 5000))

    expect(createImageBitmap).toHaveBeenCalledOnce()
    expect(canvases.map(({ width, height }) => [width, height])).toEqual([[2560, 1920], [400, 300]])
    expect(result).toEqual({
      original: { blob: compressed, mimeType: 'image/webp' },
      thumbnail: { blob: thumbnail, mimeType: 'image/webp' },
      width: 2560,
      height: 1920,
    })
    expect(close).toHaveBeenCalledOnce()
  })

  test('keeps the original when compression does not make it smaller', async () => {
    stubDecodedImage(800, 600)
    const file = makeFile('small.png', 'image/png', 300)
    const thumbnail = new Blob([new Uint8Array(50)], { type: 'image/webp' })
    encodedBlobs.push(new Blob([new Uint8Array(900)], { type: 'image/webp' }), thumbnail)

    const result = await processPhoto(file)

    expect(result.original).toEqual({ blob: file, mimeType: 'image/png' })
    expect(result.thumbnail).toEqual({ blob: thumbnail, mimeType: 'image/webp' })
    expect(result).toMatchObject({ width: 800, height: 600 })
  })

  test('keeps a GIF as-is so animation survives, but still makes a thumbnail', async () => {
    stubDecodedImage(1200, 900)
    const file = makeFile('dance.gif', 'image/gif', 5000)
    const thumbnail = new Blob([new Uint8Array(50)], { type: 'image/webp' })
    encodedBlobs.push(thumbnail)

    const result = await processPhoto(file)

    expect(canvases).toHaveLength(1)
    expect(result).toEqual({
      original: { blob: file, mimeType: 'image/gif' },
      thumbnail: { blob: thumbnail, mimeType: 'image/webp' },
      width: 1200,
      height: 900,
    })
  })

  test('records the type the browser actually produced', async () => {
    // Browsers that can't encode WebP return PNG instead.
    stubDecodedImage(4000, 3000)
    const compressed = new Blob([new Uint8Array(500)], { type: 'image/png' })
    const thumbnail = new Blob([new Uint8Array(50)], { type: 'image/png' })
    encodedBlobs.push(compressed, thumbnail)

    const result = await processPhoto(makeFile('garden.jpg', 'image/jpeg', 5000))

    expect(result.original.mimeType).toBe('image/png')
    expect(result.thumbnail.mimeType).toBe('image/png')
  })

  test('uploads the original for both files when the browser cannot decode it', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new DOMException('Unsupported', 'InvalidStateError')))
    const file = makeFile('IMG_0042.heic', 'image/heic', 3000)

    const result = await processPhoto(file)

    expect(result).toEqual({
      original: { blob: file, mimeType: 'image/heic' },
      thumbnail: { blob: file, mimeType: 'image/heic' },
      width: null,
      height: null,
    })
  })

  test('releases the decoded image even when encoding fails', async () => {
    stubDecodedImage(4000, 3000)
    // No blobs queued, so toBlob reports failure.

    await expect(processPhoto(makeFile('garden.jpg', 'image/jpeg', 5000))).rejects.toThrow(
      "Couldn't encode the image.",
    )
    expect(close).toHaveBeenCalledOnce()
  })
})
