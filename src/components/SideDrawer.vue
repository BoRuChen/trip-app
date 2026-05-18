<script setup lang="ts">
import { ref } from 'vue'
import PlaceList from './PlaceList.vue'
import CategoryManager from './CategoryManager.vue'
import { usePlacesStore } from '@/stores/places'
import { useCategoriesStore } from '@/stores/categories'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; select: [id: string] }>()

const places = usePlacesStore()
const categories = useCategoriesStore()

type Tab = 'places' | 'categories' | 'settings'
const tab = ref<Tab>('places')

function handleSelect(id: string) {
  emit('select', id)
  emit('close')
}

function exportJson() {
  const data = JSON.stringify(
    {
      schemaVersion: 1,
      categories: categories.categories,
      places: places.places,
    },
    null,
    2,
  )
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trip-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const fileInput = ref<HTMLInputElement | null>(null)

async function handleImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const data = JSON.parse(text)
    if (data.schemaVersion !== 1) {
      alert('版本不相容')
      return
    }
    const merge = confirm('OK = 合併（保留現有）、取消 = 完全取代')
    if (!merge) {
      categories.categories = data.categories
      places.setAll(data.places)
    } else {
      const existingPlaceIds = new Set(places.places.map((p) => p.id))
      for (const p of data.places) if (!existingPlaceIds.has(p.id)) places.places.push(p)
      const existingCatIds = new Set(categories.categories.map((c) => c.id))
      for (const c of data.categories) if (!existingCatIds.has(c.id)) categories.categories.push(c)
    }
    alert('匯入完成')
  } catch (err) {
    alert('匯入失敗：' + (err as Error).message)
  } finally {
    input.value = '' // allow re-importing the same file
  }
}

function clearAll() {
  if (confirm('真的要清除所有景點與自訂分類嗎？此操作無法復原。')) {
    if (confirm('再次確認：所有資料將消失')) {
      places.setAll([])
      categories.categories = categories.categories.filter((c) => c.isDefault)
    }
  }
}
</script>

<template>
  <Transition name="drawer">
    <div v-if="open" class="backdrop" @click.self="emit('close')">
      <aside class="drawer">
        <header>
          <h2>Trip</h2>
          <button @click="emit('close')" aria-label="關閉">✕</button>
        </header>

        <nav class="tabs">
          <button :class="{ active: tab === 'places' }" @click="tab = 'places'">景點</button>
          <button :class="{ active: tab === 'categories' }" @click="tab = 'categories'">分類</button>
          <button :class="{ active: tab === 'settings' }" @click="tab = 'settings'">設定</button>
        </nav>

        <div class="content">
          <PlaceList v-if="tab === 'places'" @select="handleSelect" />
          <CategoryManager v-else-if="tab === 'categories'" />
          <div v-else class="settings">
            <button @click="exportJson">匯出 JSON 備份</button>
            <button @click="fileInput?.click()">匯入 JSON</button>
            <input
              ref="fileInput"
              type="file"
              accept="application/json"
              style="display: none"
              @change="handleImportFile"
            />
            <button class="danger" @click="clearAll">清除所有資料</button>
          </div>
        </div>
      </aside>
    </div>
  </Transition>
</template>

<style scoped>
.backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); z-index: 1800;
}
.drawer {
  position: fixed; top: 0; left: 0; bottom: 0;
  width: min(85vw, 360px);
  background: white;
  display: flex; flex-direction: column;
  box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
}
header { display: flex; align-items: center; padding: 12px 16px; border-bottom: 1px solid #eee; }
header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
header button { background: none; border: none; font-size: 1.2rem; cursor: pointer; }
.tabs { display: flex; border-bottom: 1px solid #eee; }
.tabs button {
  flex: 1; padding: 12px; background: none; border: none;
  font-size: 0.95rem; cursor: pointer; color: #666;
  border-bottom: 2px solid transparent;
}
.tabs button.active { color: #3b82f6; border-bottom-color: #3b82f6; }
.content { flex: 1; padding: 12px 16px; overflow-y: auto; }
.settings { display: flex; flex-direction: column; gap: 8px; }
.settings button { padding: 12px; border: 1px solid #ddd; background: white; border-radius: 8px; font-size: 1rem; cursor: pointer; }
.settings button.danger { color: #ef4444; border-color: #ef4444; }

.drawer-enter-active, .drawer-leave-active { transition: opacity 0.2s; }
.drawer-enter-active .drawer, .drawer-leave-active .drawer { transition: transform 0.2s; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; }
.drawer-enter-from .drawer, .drawer-leave-to .drawer { transform: translateX(-100%); }
</style>
