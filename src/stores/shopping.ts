import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { ShoppingItem } from '@/types'
import { deleteImages } from './imageStore'

export const useShoppingStore = defineStore('shopping', () => {
  const items = ref<ShoppingItem[]>([])

  function add(input: Omit<ShoppingItem, 'id' | 'createdAt'>) {
    items.value.push({ id: uuid(), createdAt: Date.now(), ...input })
  }

  function update(id: string, patch: Partial<Omit<ShoppingItem, 'id' | 'createdAt'>>) {
    const it = items.value.find((i) => i.id === id)
    if (it) Object.assign(it, patch)
  }

  function togglePurchased(id: string) {
    const it = items.value.find((i) => i.id === id)
    if (it) it.purchased = !it.purchased
  }

  async function remove(id: string) {
    const it = items.value.find((i) => i.id === id)
    if (!it) return
    const imageIds = [...it.imageIds]
    items.value = items.value.filter((i) => i.id !== id)
    await deleteImages(imageIds)
  }

  function setAll(next: ShoppingItem[]) {
    items.value = next
  }

  return { items, add, update, togglePurchased, remove, setAll }
})
