<script setup lang="ts">
import { ref } from 'vue'
import MapView from './components/MapView.vue'
import PlaceDetailSheet from './components/PlaceDetailSheet.vue'

const selectedPlaceId = ref<string | null>(null)

function handleEdit(_id: string) {
  // Task 8 will wire this up to AddPlaceModal in edit mode
}
</script>

<template>
  <MapView v-model:selectedPlaceId="selectedPlaceId" />
  <PlaceDetailSheet
    :placeId="selectedPlaceId"
    @close="selectedPlaceId = null"
    @edit="handleEdit"
  />
</template>

<style>
html, body, #app { margin: 0; height: 100%; }
</style>
