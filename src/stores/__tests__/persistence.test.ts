import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState } from '../persistence'
import { STORAGE_KEY, DEFAULT_CATEGORIES } from '@/constants'

describe('persistence', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when no data exists', () => {
    expect(loadState()).toBeNull()
  })

  it('round-trips a v2 state object', () => {
    const state = {
      schemaVersion: 2 as const,
      categories: DEFAULT_CATEGORIES,
      places: [{ id: 'p1', name: 'X', lat: 35, lng: 129, categoryId: 'cat-food', visited: false, createdAt: 1 }],
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

  it('migrates v1 state by adding empty shoppingItems and bumping schemaVersion', () => {
    const v1 = {
      schemaVersion: 1,
      categories: DEFAULT_CATEGORIES,
      places: [{ id: 'p1', name: 'X', lat: 35, lng: 129, categoryId: 'cat-food', visited: false, createdAt: 1 }],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1))
    const loaded = loadState()
    expect(loaded?.schemaVersion).toBe(2)
    expect(loaded?.shoppingItems).toEqual([])
    expect(loaded?.places).toEqual(v1.places)
    expect(loaded?.categories).toEqual(v1.categories)
  })
})
