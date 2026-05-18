<script setup lang="ts">
import { ref } from 'vue'
import MapView from './components/MapView.vue'
import PlaceDetailSheet from './components/PlaceDetailSheet.vue'
import AddPlaceModal from './components/AddPlaceModal.vue'
import SideDrawer from './components/SideDrawer.vue'

const selectedPlaceId = ref<string | null>(null)
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const drawerOpen = ref(false)

const mapViewRef = ref<InstanceType<typeof MapView> | null>(null)

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

function handleListSelect(id: string) {
  mapViewRef.value?.focusPlace(id)
}
</script>

<template>
  <MapView ref="mapViewRef" v-model:selectedPlaceId="selectedPlaceId" />

  <button class="fab-menu" @click="drawerOpen = true" aria-label="選單">☰</button>
  <button class="fab-add" @click="openAdd" aria-label="新增景點">＋</button>

  <PlaceDetailSheet
    :placeId="selectedPlaceId"
    @close="selectedPlaceId = null"
    @edit="handleEdit"
  />
  <AddPlaceModal :open="modalOpen" :editingId="editingId" @close="closeModal" />
  <SideDrawer
    :open="drawerOpen"
    @close="drawerOpen = false"
    @select="handleListSelect"
  />
</template>

<style>
html, body, #app { margin: 0; height: 100%; font-family: -apple-system, system-ui, sans-serif; }

.fab-menu, .fab-add {
  position: fixed; top: 16px;
  width: 44px; height: 44px;
  border-radius: 50%;
  border: none;
  font-size: 1.3rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1500;
  cursor: pointer;
}
.fab-menu { left: 16px; background: white; color: #333; }
.fab-add { right: 16px; background: #3b82f6; color: white; font-size: 1.6rem; }
</style>
