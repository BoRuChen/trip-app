import { watch } from 'vue'
import { useCategoriesStore } from './categories'
import { useShoppingStore } from './shopping'
import { loadState, saveState } from './persistence'

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function initStores() {
  const categories = useCategoriesStore()
  const shopping = useShoppingStore()

  const loaded = loadState()
  if (loaded) {
    categories.categories = loaded.categories
    shopping.setAll(loaded.shoppingItems)
  }

  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveState({
        schemaVersion: 3,
        categories: categories.categories,
        shoppingItems: shopping.items,
      })
    }, 300)
  }

  watch(() => categories.categories, persist, { deep: true })
  watch(() => shopping.items, persist, { deep: true })
}
