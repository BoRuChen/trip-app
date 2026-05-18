import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState } from '../persistence'
import { STORAGE_KEY, DEFAULT_CATEGORIES } from '@/constants'

describe('persistence', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when no data exists', () => {
    expect(loadState()).toBeNull()
  })

  it('round-trips a state object', () => {
    const state = {
      schemaVersion: 1 as const,
      categories: DEFAULT_CATEGORIES,
      places: [{ id: 'p1', name: 'X', lat: 35, lng: 129, categoryId: 'cat-food', visited: false, createdAt: 1 }],
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
})
