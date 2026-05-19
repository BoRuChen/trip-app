import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useShoppingStore } from '../shopping'
import { saveImage, loadImage, _resetForTest } from '../imageStore'

describe('useShoppingStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    await _resetForTest()
  })

  it('starts with empty items', () => {
    const store = useShoppingStore()
    expect(store.items).toEqual([])
  })

  it('add() appends a new item with id/createdAt assigned', () => {
    const store = useShoppingStore()
    store.add({ name: 'kimchi', quantity: '2', location: 'Lotte Mart', imageIds: [], purchased: false })
    expect(store.items).toHaveLength(1)
    const item = store.items[0]
    expect(item.id).toBeTruthy()
    expect(typeof item.createdAt).toBe('number')
    expect(item.name).toBe('kimchi')
    expect(item.purchased).toBe(false)
  })

  it('update() patches fields of an existing item', () => {
    const store = useShoppingStore()
    store.add({ name: 'a', imageIds: [], purchased: false })
    const id = store.items[0].id
    store.update(id, { name: 'b', note: 'tasty' })
    expect(store.items[0].name).toBe('b')
    expect(store.items[0].note).toBe('tasty')
  })

  it('update() is a no-op for unknown id', () => {
    const store = useShoppingStore()
    store.add({ name: 'a', imageIds: [], purchased: false })
    store.update('does-not-exist', { name: 'b' })
    expect(store.items[0].name).toBe('a')
  })

  it('togglePurchased flips purchased flag', () => {
    const store = useShoppingStore()
    store.add({ name: 'a', imageIds: [], purchased: false })
    const id = store.items[0].id
    store.togglePurchased(id)
    expect(store.items[0].purchased).toBe(true)
    store.togglePurchased(id)
    expect(store.items[0].purchased).toBe(false)
  })

  it('remove() deletes item AND its images from IndexedDB', async () => {
    const store = useShoppingStore()
    const imageId = await saveImage(new Blob(['x']))
    store.add({ name: 'with-img', imageIds: [imageId], purchased: false })
    const itemId = store.items[0].id

    await store.remove(itemId)
    expect(store.items).toHaveLength(0)
    expect(await loadImage(imageId)).toBeNull()
  })

  it('setAll() replaces items wholesale', () => {
    const store = useShoppingStore()
    store.setAll([
      { id: 's1', name: 'one', imageIds: [], purchased: false, createdAt: 1 },
      { id: 's2', name: 'two', imageIds: [], purchased: true, createdAt: 2 },
    ])
    expect(store.items).toHaveLength(2)
    expect(store.items[1].purchased).toBe(true)
  })
})
