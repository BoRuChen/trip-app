import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState } from '../persistence'
import { STORAGE_KEY, DEFAULT_CATEGORIES } from '@/constants'

describe('persistence', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when no data exists', () => {
    expect(loadState()).toBeNull()
  })

  it('round-trips a v3 state object (no places field)', () => {
    const state = {
      schemaVersion: 3 as const,
      categories: DEFAULT_CATEGORIES,
      shoppingItems: [{ id: 's1', name: 'kimchi', imageIds: [], purchased: false, createdAt: 2 }],
    }
    saveState(state)
    expect(loadState()).toEqual(state)
  })

  it('returns null on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadState()).toBeNull()
  })

  it('returns null when schemaVersion is unknown', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }))
    expect(loadState()).toBeNull()
  })

  it('migrates v2 by dropping places (cloud-first migration)', () => {
    const v2 = {
      schemaVersion: 2,
      categories: DEFAULT_CATEGORIES,
      places: [{ id: 'p1', name: 'X', lat: 35, lng: 129, categoryId: 'cat-food', visited: false, createdAt: 1 }],
      shoppingItems: [{ id: 's1', name: 'k', imageIds: [], purchased: false, createdAt: 2 }],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2))
    const loaded = loadState()
    expect(loaded?.schemaVersion).toBe(3)
    expect(loaded?.categories).toEqual(v2.categories)
    expect(loaded?.shoppingItems).toEqual(v2.shoppingItems)
    expect((loaded as unknown as { places?: unknown }).places).toBeUndefined()
  })

  it('migrates v1 by adding empty shoppingItems and dropping places', () => {
    const v1 = {
      schemaVersion: 1,
      categories: DEFAULT_CATEGORIES,
      places: [{ id: 'p1', name: 'X', lat: 35, lng: 129, categoryId: 'cat-food', visited: false, createdAt: 1 }],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1))
    const loaded = loadState()
    expect(loaded?.schemaVersion).toBe(3)
    expect(loaded?.categories).toEqual(v1.categories)
    expect(loaded?.shoppingItems).toEqual([])
    expect((loaded as unknown as { places?: unknown }).places).toBeUndefined()
  })
})
