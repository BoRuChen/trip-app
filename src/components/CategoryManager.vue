<script setup lang="ts">
import { ref } from 'vue'
import { useCategoriesStore } from '@/stores/categories'

const categories = useCategoriesStore()

const AVAILABLE_ICONS = ['utensils', 'coffee', 'camera', 'shopping-bag', 'bed', 'train']

const newName = ref('')
const newColor = ref('#3b82f6')
const newIcon = ref('camera')

function addCategory() {
  const name = newName.value.trim()
  if (!name) return
  categories.add({ name, color: newColor.value, icon: newIcon.value })
  newName.value = ''
}

function removeCategory(id: string) {
  if (confirm('刪除這個分類？（已使用此分類的景點不會被刪除，但會顯示為「未分類」）')) {
    categories.remove(id)
  }
}
</script>

<template>
  <div class="cat-root">
    <div v-for="c in categories.categories" :key="c.id" class="cat-row">
      <input
        type="color"
        :value="c.color"
        @input="(e) => categories.update(c.id, { color: (e.target as HTMLInputElement).value })"
      />
      <input
        type="text"
        :value="c.name"
        @input="(e) => categories.update(c.id, { name: (e.target as HTMLInputElement).value })"
        class="name"
      />
      <select
        :value="c.icon"
        @change="(e) => categories.update(c.id, { icon: (e.target as HTMLSelectElement).value })"
      >
        <option v-for="i in AVAILABLE_ICONS" :key="i" :value="i">{{ i }}</option>
      </select>
      <button
        class="del"
        :disabled="c.isDefault"
        :title="c.isDefault ? '預設分類無法刪除' : '刪除'"
        @click="removeCategory(c.id)"
      >
        ✕
      </button>
    </div>

    <div class="add-row">
      <input type="color" v-model="newColor" />
      <input v-model="newName" placeholder="新分類名稱" class="name" />
      <select v-model="newIcon">
        <option v-for="i in AVAILABLE_ICONS" :key="i" :value="i">{{ i }}</option>
      </select>
      <button class="add" @click="addCategory" :disabled="!newName.trim()">＋</button>
    </div>
  </div>
</template>

<style scoped>
.cat-root { display: flex; flex-direction: column; gap: 8px; }
.cat-row, .add-row { display: flex; gap: 6px; align-items: center; }
.name { flex: 1; padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.95rem; }
input[type="color"] { width: 36px; height: 36px; padding: 2px; border: 1px solid #ddd; border-radius: 4px; }
select { padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem; }
.del, .add { width: 32px; height: 32px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; }
.del:disabled { opacity: 0.3; cursor: not-allowed; }
.add { background: #3b82f6; color: white; border-color: #3b82f6; }
.add:disabled { opacity: 0.5; cursor: not-allowed; }
.add-row { margin-top: 12px; padding-top: 12px; border-top: 1px solid #eee; }
</style>
