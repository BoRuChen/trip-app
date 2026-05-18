<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'
import { BUSAN_CENTER, DEFAULT_ZOOM, NEARBY_RADIUS_M } from '@/constants'
import { usePlacesStore } from '@/stores/places'
import { useCategoriesStore } from '@/stores/categories'
import { makePlaceMarker } from './PlaceMarker'
import { useGeolocation } from '@/composables/useGeolocation'

const selectedPlaceId = defineModel<string | null>('selectedPlaceId')

const places = usePlacesStore()
const categories = useCategoriesStore()
const geo = useGeolocation()

const mapEl = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
const markers = new Map<string, L.Marker>()

const nearbyActive = ref(false)
let userMarker: L.CircleMarker | null = null
let radiusCircle: L.Circle | null = null

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

function isDimmed(p: { lat: number; lng: number; visited: boolean }): boolean {
  if (p.visited) return true
  if (nearbyActive.value && geo.position.value) {
    return distanceM(geo.position.value, p) > NEARBY_RADIUS_M
  }
  return false
}

function syncMarkers() {
  if (!map) return
  const next = new Set(places.places.map((p) => p.id))
  for (const [id, m] of markers) {
    if (!next.has(id)) {
      m.remove()
      markers.delete(id)
    }
  }
  for (const p of places.places) {
    const cat = categories.byId(p.categoryId)
    if (!cat) continue
    const icon = makePlaceMarker(cat, isDimmed(p))
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

async function activateNearby() {
  const pos = await geo.locate()
  if (!pos || !map) {
    if (geo.error.value) alert(geo.error.value)
    return
  }
  map.setView([pos.lat, pos.lng], 15)
  if (userMarker) userMarker.remove()
  userMarker = L.circleMarker([pos.lat, pos.lng], {
    radius: 8,
    color: '#fff',
    weight: 2,
    fillColor: '#3b82f6',
    fillOpacity: 1,
  }).addTo(map)
  if (radiusCircle) radiusCircle.remove()
  radiusCircle = L.circle([pos.lat, pos.lng], {
    radius: NEARBY_RADIUS_M,
    color: '#3b82f6',
    fillColor: '#3b82f6',
    fillOpacity: 0.08,
    weight: 1,
  }).addTo(map)
  nearbyActive.value = true
  syncMarkers()
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
  userMarker = null
  radiusCircle = null
})

function focusPlace(id: string) {
  const p = places.places.find((x) => x.id === id)
  if (!p || !map) return
  map.setView([p.lat, p.lng], 16)
  selectedPlaceId.value = id
}

defineExpose({ focusPlace })
</script>

<template>
  <div ref="mapEl" class="map-root" />
  <button class="fab-locate" :disabled="geo.loading.value" @click="activateNearby" aria-label="定位">
    {{ geo.loading.value ? '…' : '⊕' }}
  </button>
</template>

<style scoped>
.map-root { position: fixed; inset: 0; }

.fab-locate {
  position: fixed;
  bottom: 24px;
  right: 16px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: white;
  color: #3b82f6;
  font-size: 1.4rem;
  border: 1px solid #e0e0e0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1500;
  cursor: pointer;
}
.fab-locate:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
