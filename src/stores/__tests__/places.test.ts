import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock supabase: chainable from() + a Realtime channel.
const insertMock = vi.fn()
const updateMock = vi.fn()
const deleteMock = vi.fn()
const selectMock = vi.fn()
const eqMock = vi.fn()
const orderMock = vi.fn()

const channelOnMock = vi.fn()
const channelSubscribeMock = vi.fn()
const channelMock = { on: channelOnMock, subscribe: channelSubscribeMock }
channelOnMock.mockReturnValue(channelMock)
channelSubscribeMock.mockImplementation((_cb) => channelMock)

const fromMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    channel: () => channelMock,
    removeChannel: vi.fn(),
  },
}))

import { usePlacesStore } from '../places'

function setupFrom() {
  // Default: insert/update/delete resolve to { error: null }; select resolves to {data: [], error: null}.
  insertMock.mockResolvedValue({ error: null })
  updateMock.mockResolvedValue({ error: null })
  deleteMock.mockResolvedValue({ error: null })
  orderMock.mockResolvedValue({ data: [], error: null })
  eqMock.mockReturnValue({ order: orderMock })
  selectMock.mockReturnValue({ eq: eqMock })
  fromMock.mockReturnValue({
    insert: insertMock,
    update: () => ({ eq: updateMock }),
    delete: () => ({ eq: deleteMock }),
    select: selectMock,
  })
}

describe('usePlacesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    channelOnMock.mockReturnValue(channelMock)
    channelSubscribeMock.mockImplementation((_cb) => channelMock)
    setupFrom()
  })

  it('starts with empty places and status idle', () => {
    const store = usePlacesStore()
    expect(store.places).toEqual([])
    expect(store.status).toBe('idle')
  })

  it('loadFromCloud() fills state from supabase select', async () => {
    orderMock.mockResolvedValue({
      data: [{ id: 'p1', user_id: 'u1', name: 'X', lat: 35, lng: 129, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 }],
      error: null,
    })
    const store = usePlacesStore()
    await store.loadFromCloud('u1')
    expect(store.places).toHaveLength(1)
    expect(store.places[0].id).toBe('p1')
    expect(store.places[0].categoryId).toBe('cat-food')
  })

  it('addPlace() optimistically pushes then awaits supabase insert', async () => {
    const store = usePlacesStore()
    await store.addPlace('u1', { name: 'A', lat: 35, lng: 129, categoryId: 'cat-food', visited: false })
    expect(store.places).toHaveLength(1)
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it('addPlace() reverts state on supabase error', async () => {
    insertMock.mockResolvedValue({ error: { message: 'rls' } })
    const store = usePlacesStore()
    await store.addPlace('u1', { name: 'A', lat: 35, lng: 129, categoryId: 'cat-food', visited: false })
    expect(store.places).toHaveLength(0)
    expect(store.status).toBe('error')
  })

  it('updatePlace() patches state and calls supabase update', async () => {
    const store = usePlacesStore()
    await store.addPlace('u1', { name: 'A', lat: 35, lng: 129, categoryId: 'cat-food', visited: false })
    const id = store.places[0].id
    await store.updatePlace(id, { name: 'B' })
    expect(store.places[0].name).toBe('B')
    expect(updateMock).toHaveBeenCalled()
  })

  it('updatePlace() reverts on supabase error', async () => {
    const store = usePlacesStore()
    await store.addPlace('u1', { name: 'A', lat: 35, lng: 129, categoryId: 'cat-food', visited: false })
    const id = store.places[0].id
    updateMock.mockResolvedValueOnce({ error: { message: 'rls' } })
    await store.updatePlace(id, { name: 'B' })
    expect(store.places[0].name).toBe('A')
  })

  it('deletePlace() removes from state and calls supabase delete', async () => {
    const store = usePlacesStore()
    await store.addPlace('u1', { name: 'A', lat: 35, lng: 129, categoryId: 'cat-food', visited: false })
    const id = store.places[0].id
    await store.deletePlace(id)
    expect(store.places).toHaveLength(0)
    expect(deleteMock).toHaveBeenCalled()
  })

  it('handleChange INSERT adds row not already present', () => {
    const store = usePlacesStore()
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    expect(store.places).toHaveLength(1)
    expect(store.places[0].id).toBe('p2')
  })

  it('handleChange INSERT is idempotent for already-present id', () => {
    const store = usePlacesStore()
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    expect(store.places).toHaveLength(1)
  })

  it('handleChange UPDATE merges into existing row', () => {
    const store = usePlacesStore()
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    store.handleChange({
      eventType: 'UPDATE',
      new: { id: 'p2', user_id: 'u1', name: 'Y2', lat: 1, lng: 2, category_id: 'cat-food', visited: true, created_at: 1, updated_at: 2 },
    })
    expect(store.places[0].name).toBe('Y2')
    expect(store.places[0].visited).toBe(true)
  })

  it('handleChange DELETE removes row by id', () => {
    const store = usePlacesStore()
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    store.handleChange({ eventType: 'DELETE', old: { id: 'p2' } })
    expect(store.places).toHaveLength(0)
  })

  it('reset() clears state and unsubscribes', () => {
    const store = usePlacesStore()
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    store.reset()
    expect(store.places).toEqual([])
  })
})
