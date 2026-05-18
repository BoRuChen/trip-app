<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import L from 'leaflet'
import { BUSAN_CENTER, DEFAULT_ZOOM } from '@/constants'

const mapEl = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value).setView(BUSAN_CENTER, DEFAULT_ZOOM)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)
})

onUnmounted(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="mapEl" class="map-root" />
</template>

<style scoped>
.map-root { position: fixed; inset: 0; }
</style>
