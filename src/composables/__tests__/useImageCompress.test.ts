import { describe, it, expect, vi, beforeEach } from 'vitest'
import { compressImage, MAX_WIDTH, JPEG_QUALITY } from '../useImageCompress'

interface FakeCanvas {
  width: number
  height: number
  getContext: ReturnType<typeof vi.fn>
  toBlob: (cb: (b: Blob | null) => void, type: string, quality: number) => void
}

function mockCanvas(): FakeCanvas {
  const drawImage = vi.fn()
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ({ drawImage })),
    toBlob(cb, type, quality) {
      cb(new Blob([`encoded-${this.width}x${this.height}-${type}-${quality}`], { type }))
    },
  }
}

describe('useImageCompress', () => {
  const created: FakeCanvas[] = []

  beforeEach(() => {
    created.length = 0
    vi.stubGlobal('document', {
      createElement: (tag: string) => {
        if (tag !== 'canvas') throw new Error(`unexpected tag ${tag}`)
        const c = mockCanvas()
        created.push(c)
        return c
      },
    })
  })

  it('scales down when source wider than MAX_WIDTH (1280)', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 2000 })))
    const file = new File(['raw'], 'a.jpg', { type: 'image/jpeg' })

    const out = await compressImage(file)
    expect(out.type).toBe('image/jpeg')

    const canvas = created[0]
    expect(canvas.width).toBe(MAX_WIDTH)
    expect(canvas.height).toBe(640) // 2000 * (1280/4000)
  })

  it('does not upscale when source smaller than MAX_WIDTH', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 800, height: 600 })))
    const file = new File(['raw'], 'a.jpg', { type: 'image/jpeg' })

    await compressImage(file)
    const canvas = created[0]
    expect(canvas.width).toBe(800)
    expect(canvas.height).toBe(600)
  })

  it('outputs JPEG at configured quality', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 100, height: 100 })))
    const file = new File(['raw'], 'a.jpg', { type: 'image/jpeg' })

    const out = await compressImage(file)
    const buf = await out.arrayBuffer()
    const text = new TextDecoder().decode(buf)
    expect(text).toBe(`encoded-100x100-image/jpeg-${JPEG_QUALITY}`)
  })

  it('requests EXIF orientation from createImageBitmap', async () => {
    const fn = vi.fn(async () => ({ width: 100, height: 100 }))
    vi.stubGlobal('createImageBitmap', fn)
    const file = new File(['raw'], 'a.jpg', { type: 'image/jpeg' })

    await compressImage(file)
    expect(fn).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' })
  })
})
