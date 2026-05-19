import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  saveImage,
  saveImageWithId,
  loadImage,
  deleteImage,
  deleteImages,
  clearAllImages,
  _resetForTest,
} from '../imageStore'

describe('imageStore', () => {
  beforeEach(async () => {
    await _resetForTest()
  })

  it('saves a blob and loads it back', async () => {
    const blob = new Blob(['hello'], { type: 'image/jpeg' })
    const id = await saveImage(blob)
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)

    const loaded = await loadImage(id)
    expect(loaded).not.toBeNull()
    expect(loaded!.size).toBe(5)
    expect(loaded!.type).toBe('image/jpeg')
    const buf = await loaded!.arrayBuffer()
    expect(new TextDecoder().decode(buf)).toBe('hello')
  })

  it('returns null when loading a missing id', async () => {
    const loaded = await loadImage('nonexistent-id')
    expect(loaded).toBeNull()
  })

  it('deletes an image', async () => {
    const id = await saveImage(new Blob(['x']))
    await deleteImage(id)
    expect(await loadImage(id)).toBeNull()
  })

  it('deleteImages removes multiple in one call', async () => {
    const id1 = await saveImage(new Blob(['a']))
    const id2 = await saveImage(new Blob(['b']))
    const id3 = await saveImage(new Blob(['c']))
    await deleteImages([id1, id3])
    expect(await loadImage(id1)).toBeNull()
    expect(await loadImage(id2)).not.toBeNull()
    expect(await loadImage(id3)).toBeNull()
  })

  it('deleteImages handles empty array without error', async () => {
    await expect(deleteImages([])).resolves.toBeUndefined()
  })

  it('generates unique ids for sequential saves', async () => {
    const ids = await Promise.all([
      saveImage(new Blob(['1'])),
      saveImage(new Blob(['2'])),
      saveImage(new Blob(['3'])),
    ])
    expect(new Set(ids).size).toBe(3)
  })

  it('saveImageWithId stores under the supplied id', async () => {
    await saveImageWithId('fixed-id-123', new Blob(['payload'], { type: 'image/png' }))
    const loaded = await loadImage('fixed-id-123')
    expect(loaded).not.toBeNull()
    expect(loaded!.type).toBe('image/png')
    const buf = await loaded!.arrayBuffer()
    expect(new TextDecoder().decode(buf)).toBe('payload')
  })

  it('saveImageWithId overwrites an existing entry with the same id', async () => {
    await saveImageWithId('dup', new Blob(['old']))
    await saveImageWithId('dup', new Blob(['new'], { type: 'image/jpeg' }))
    const loaded = await loadImage('dup')
    expect(loaded!.type).toBe('image/jpeg')
    expect(new TextDecoder().decode(await loaded!.arrayBuffer())).toBe('new')
  })

  it('clearAllImages empties the store', async () => {
    const id1 = await saveImage(new Blob(['a']))
    const id2 = await saveImage(new Blob(['b']))
    await clearAllImages()
    expect(await loadImage(id1)).toBeNull()
    expect(await loadImage(id2)).toBeNull()
  })

  it('clearAllImages on an already-empty store is a no-op', async () => {
    await expect(clearAllImages()).resolves.toBeUndefined()
  })
})