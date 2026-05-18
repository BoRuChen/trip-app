import type { PersistedState } from '@/types'
import { STORAGE_KEY } from '@/constants'

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (parsed.schemaVersion !== 1) return null
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.places)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
