import { watch } from 'vue'
import { useCategoriesStore } from './categories'
import { usePlacesStore } from './places'
import { loadState, saveState } from './persistence'

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function initStores() {
  const categories = useCategoriesStore()
  const places = usePlacesStore()

  const loaded = loadState()
  if (loaded) {
    categories.categories = loaded.categories
    places.setAll(loaded.places)
  }

  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveState({
        schemaVersion: 2,
        categories: categories.categories,
        places: places.places,
        shoppingItems: [],
      })
    }, 300)
  }

  watch(() => categories.categories, persist, { deep: true })
  watch(() => places.places, persist, { deep: true })
}
