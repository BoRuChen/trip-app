<script setup lang="ts">
import { ref } from 'vue'
import MapView from './components/MapView.vue'
import PlaceDetailSheet from './components/PlaceDetailSheet.vue'
import AddPlaceModal from './components/AddPlaceModal.vue'

const selectedPlaceId = ref<string | null>(null)
const modalOpen = ref(false)
const editingId = ref<string | null>(null)

function openAdd() {
  editingId.value = null
  modalOpen.value = true
}

function handleEdit(id: string) {
  editingId.value = id
  modalOpen.value = true
  selectedPlaceId.value = null
}

function closeModal() {
  modalOpen.value = false
  editingId.value = null
}
</script>

<template>
  <MapView v-model:selectedPlaceId="selectedPlaceId" />
  <PlaceDetailSheet
    :placeId="selectedPlaceId"
    @close="selectedPlaceId = null"
    @edit="handleEdit"
  />
  <button class="fab-add" @click="openAdd" aria-label="新增景點">＋</button>
  <AddPlaceModal :open="modalOpen" :editingId="editingId" @close="closeModal" />
</template>

<style>
html, body, #app { margin: 0; height: 100%; font-family: -apple-system, system-ui, sans-serif; }

.fab-add {
  position: fixed;
  top: 16px;
  right: 16px;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #3b82f6;
  color: white;
  font-size: 1.6rem;
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  z-index: 1500;
  cursor: pointer;
}
</style>
