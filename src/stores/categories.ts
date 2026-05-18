import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Category } from '@/types'
import { DEFAULT_CATEGORIES } from '@/constants'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([...DEFAULT_CATEGORIES])

  function add(input: Omit<Category, 'id' | 'isDefault'>) {
    categories.value.push({ id: uuid(), isDefault: false, ...input })
  }
  function update(id: string, patch: Partial<Omit<Category, 'id' | 'isDefault'>>) {
    const c = categories.value.find((c) => c.id === id)
    if (c) Object.assign(c, patch)
  }
  function remove(id: string) {
    const c = categories.value.find((c) => c.id === id)
    if (!c || c.isDefault) return  // default categories cannot be deleted
    categories.value = categories.value.filter((c) => c.id !== id)
  }
  function byId(id: string) {
    return categories.value.find((c) => c.id === id)
  }

  return { categories, add, update, remove, byId }
})
