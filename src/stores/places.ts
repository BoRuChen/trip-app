import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Place } from '@/types'

export const usePlacesStore = defineStore('places', () => {
  const places = ref<Place[]>([])

  function add(input: Omit<Place, 'id' | 'createdAt'>) {
    places.value.push({ id: uuid(), createdAt: Date.now(), ...input })
  }
  function update(id: string, patch: Partial<Omit<Place, 'id' | 'createdAt'>>) {
    const p = places.value.find((p) => p.id === id)
    if (p) Object.assign(p, patch)
  }
  function remove(id: string) {
    places.value = places.value.filter((p) => p.id !== id)
  }
  function setAll(next: Place[]) {
    places.value = next
  }

  return { places, add, update, remove, setAll }
})
