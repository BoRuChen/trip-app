<script setup lang="ts">
import { computed, ref } from 'vue'
import { useShoppingStore } from '@/stores/shopping'
import ShoppingItemRow from './ShoppingItemRow.vue'
import AddShoppingItemModal from './AddShoppingItemModal.vue'

const shopping = useShoppingStore()

const modalOpen = ref(false)
const editingId = ref<string | null>(null)

const sorted = computed(() => [...shopping.items].sort((a, b) => b.createdAt - a.createdAt))
const unpurchased = computed(() => sorted.value.filter((i) => !i.purchased))
const purchased = computed(() => sorted.value.filter((i) => i.purchased))

function openAdd() {
  editingId.value = null
  modalOpen.value = true
}
function openEdit(id: string) {
  editingId.value = id
  modalOpen.value = true
}
function closeModal() {
  modalOpen.value = false
  editingId.value = null
}
</script>

<template>
  <div class="list-root">
    <button class="add" @click="openAdd">＋ 新增購買項目</button>

    <p v-if="shopping.items.length === 0" class="empty">還沒有購買項目</p>

    <div v-if="unpurchased.length > 0" class="section">
      <h3>待購 <span class="count">{{ unpurchased.length }}</span></h3>
      <ShoppingItemRow
        v-for="item in unpurchased"
        :key="item.id"
        :item="item"
        @edit="openEdit"
        @toggle="shopping.togglePurchased"
      />
    </div>

    <div v-if="purchased.length > 0" class="section">
      <h3>已購 <span class="count">{{ purchased.length }}</span></h3>
      <ShoppingItemRow
        v-for="item in purchased"
        :key="item.id"
        :item="item"
        @edit="openEdit"
        @toggle="shopping.togglePurchased"
      />
    </div>

    <AddShoppingItemModal :open="modalOpen" :editing-id="editingId" @close="closeModal" />
  </div>
</template>

<style scoped>
.list-root { display: flex; flex-direction: column; gap: 8px; }
.add {
  padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 8px;
  font-size: 0.95rem; cursor: pointer;
}
.empty { color: #888; text-align: center; padding: 24px 0; }
.section h3 { margin: 12px 0 6px; padding-left: 8px; border-left: 3px solid #ccc; font-size: 0.95rem; }
.section h3 .count { color: #888; font-weight: normal; margin-left: 6px; font-size: 0.85rem; }
</style>
