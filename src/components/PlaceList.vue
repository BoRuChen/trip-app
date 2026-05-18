<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePlacesStore } from '@/stores/places'
import { useCategoriesStore } from '@/stores/categories'

const emit = defineEmits<{ select: [id: string] }>()

const places = usePlacesStore()
const categories = useCategoriesStore()

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return places.places
  return places.places.filter(
    (p) => p.name.toLowerCase().includes(q) || (p.note?.toLowerCase().includes(q) ?? false),
  )
})

const grouped = computed(() => {
  const map = new Map<string, typeof places.places>()
  for (const c of categories.categories) map.set(c.id, [])
  for (const p of filtered.value) {
    if (!map.has(p.categoryId)) map.set(p.categoryId, [])
    map.get(p.categoryId)!.push(p)
  }
  return categories.categories
    .map((c) => ({ category: c, items: map.get(c.id) ?? [] }))
    .filter((g) => g.items.length > 0)
})
</script>

<template>
  <div class="list-root">
    <input v-model="query" placeholder="搜尋景點…" class="search" />
    <p v-if="grouped.length === 0" class="empty">沒有景點</p>
    <div v-for="g in grouped" :key="g.category.id" class="group">
      <h3 :style="{ borderLeftColor: g.category.color }">
        {{ g.category.name }}
        <span class="count">{{ g.items.length }}</span>
      </h3>
      <button v-for="p in g.items" :key="p.id" class="row" @click="emit('select', p.id)">
        <span class="dot" :style="{ background: g.category.color, opacity: p.visited ? 0.4 : 1 }"></span>
        <span class="name" :class="{ visited: p.visited }">{{ p.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-root { display: flex; flex-direction: column; gap: 8px; }
.search { padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; box-sizing: border-box; width: 100%; }
.empty { color: #888; text-align: center; padding: 24px 0; }
.group h3 { margin: 12px 0 6px; padding-left: 8px; border-left: 3px solid #ccc; font-size: 0.95rem; }
.group h3 .count { color: #888; font-weight: normal; margin-left: 6px; font-size: 0.85rem; }
.row { display: flex; align-items: center; gap: 8px; padding: 8px; width: 100%; background: none; border: none; border-bottom: 1px solid #f0f0f0; text-align: left; cursor: pointer; }
.row:hover { background: #f8f8f8; }
.dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.name { font-size: 0.95rem; }
.name.visited { text-decoration: line-through; color: #888; }
</style>
