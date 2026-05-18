<script setup lang="ts">
import { computed } from 'vue'
import { usePlacesStore } from '@/stores/places'
import { useCategoriesStore } from '@/stores/categories'

const props = defineProps<{ placeId: string | null }>()
const emit = defineEmits<{ close: []; edit: [id: string] }>()

const places = usePlacesStore()
const categories = useCategoriesStore()

const place = computed(() => places.places.find((p) => p.id === props.placeId))
const category = computed(() => place.value && categories.byId(place.value.categoryId))

function openInGoogleMaps() {
  if (!place.value) return
  window.open(
    `https://www.google.com/maps/search/?api=1&query=${place.value.lat},${place.value.lng}`,
    '_blank',
  )
}
function toggleVisited() {
  if (place.value) places.update(place.value.id, { visited: !place.value.visited })
}
function remove() {
  if (place.value && confirm(`刪除「${place.value.name}」？`)) {
    places.remove(place.value.id)
    emit('close')
  }
}
</script>

<template>
  <div v-if="place" class="sheet">
    <header>
      <span class="cat-chip" :style="{ background: category?.color }">{{ category?.name }}</span>
      <h2>{{ place.name }}</h2>
      <button @click="emit('close')" aria-label="關閉">✕</button>
    </header>
    <p v-if="place.note" class="note">{{ place.note }}</p>
    <div class="actions">
      <button @click="toggleVisited">{{ place.visited ? '標記為未去' : '標記已去過' }}</button>
      <button @click="openInGoogleMaps">用 Google Maps 開啟</button>
      <button @click="emit('edit', place.id)">編輯</button>
      <button class="danger" @click="remove">刪除</button>
    </div>
  </div>
</template>

<style scoped>
.sheet {
  position: fixed; left: 0; right: 0; bottom: 0;
  background: white; border-radius: 16px 16px 0 0;
  padding: 16px; box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
  z-index: 1000;
}
header { display: flex; align-items: center; gap: 8px; }
header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
header button { background: none; border: none; font-size: 1.2rem; cursor: pointer; }
.cat-chip { color: white; padding: 2px 8px; border-radius: 999px; font-size: 0.85rem; }
.note { color: #555; margin: 12px 0; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.actions button { padding: 8px 12px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; }
.actions .danger { color: #ef4444; border-color: #ef4444; }
</style>
