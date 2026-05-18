<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'
import { BUSAN_CENTER, DEFAULT_ZOOM } from '@/constants'
import { usePlacesStore } from '@/stores/places'
import { useCategoriesStore } from '@/stores/categories'
import { makePlaceMarker } from './PlaceMarker'

const selectedPlaceId = defineModel<string | null>('selectedPlaceId')

const places = usePlacesStore()
const categories = useCategoriesStore()

const mapEl = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
const markers = new Map<string, L.Marker>()

function syncMarkers() {
  if (!map) return
  const next = new Set(places.places.map((p) => p.id))
  // remove markers for deleted places
  for (const [id, m] of markers) {
    if (!next.has(id)) {
      m.remove()
      markers.delete(id)
    }
  }
  // add or update markers for current places
  for (const p of places.places) {
    const cat = categories.byId(p.categoryId)
    if (!cat) continue
    const icon = makePlaceMarker(cat, p.visited)
    const existing = markers.get(p.id)
    if (existing) {
      existing.setLatLng([p.lat, p.lng])
      existing.setIcon(icon)
    } else {
      const m = L.marker([p.lat, p.lng], { icon })
        .addTo(map)
        .on('click', () => {
          selectedPlaceId.value = p.id
        })
      markers.set(p.id, m)
    }
  }
}

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value).setView(BUSAN_CENTER, DEFAULT_ZOOM)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)
  syncMarkers()
})

watch(
  () => [places.places, categories.categories],
  () => syncMarkers(),
  { deep: true },
)

onUnmounted(() => {
  map?.remove()
  map = null
  markers.clear()
})
</script>

<template>
  <div ref="mapEl" class="map-root" />
</template>

<style scoped>
.map-root { position: fixed; inset: 0; }
</style>
