import type { PersistedState } from '@/types'
import { STORAGE_KEY } from '@/constants'

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.places)) return null

    if (parsed.schemaVersion === 2) {
      if (!Array.isArray(parsed.shoppingItems)) return null
      return parsed as PersistedState
    }
    if (parsed.schemaVersion === 1) {
      return {
        schemaVersion: 2,
        categories: parsed.categories,
        places: parsed.places,
        shoppingItems: [],
      }
    }
    return null
  } catch {
    return null
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}