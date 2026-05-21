<script setup lang="ts">
import { ref } from 'vue'
import PlaceList from './PlaceList.vue'
import ShoppingList from './ShoppingList.vue'
import { useCategoriesStore } from '@/stores/categories'
import { useShoppingStore } from '@/stores/shopping'
import {
  loadImage,
  saveImageWithId,
  clearAllImages,
  deleteImages,
} from '@/stores/imageStore'

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  const CHUNK = 0x8000
  let bin = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[])
  }
  return btoa(bin)
}

function base64ToBlob(b64: string, type: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; select: [id: string] }>()

const categories = useCategoriesStore()
const shopping = useShoppingStore()

type Tab = 'places' | 'shopping' | 'settings'
const tab = ref<Tab>('places')

function handleSelect(id: string) {
  emit('select', id)
  emit('close')
}

async function exportJson() {
  const allIds = [...new Set(shopping.items.flatMap((i) => i.imageIds))]
  const images: Record<string, { data: string; type: string }> = {}
  for (const id of allIds) {
    const blob = await loadImage(id)
    if (!blob) continue
    const buf = await blob.arrayBuffer()
    images[id] = { data: bufferToBase64(buf), type: blob.type }
  }
  const data = JSON.stringify(
    {
      schemaVersion: 3,
      categories: categories.categories,
      shoppingItems: shopping.items,
      images,
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

    if (data.schemaVersion !== 1 && data.schemaVersion !== 2 && data.schemaVersion !== 3) {
      alert('版本不相容')
      return
    }
    if (
      (data.schemaVersion === 2 || data.schemaVersion === 3) &&
      !Array.isArray(data.shoppingItems)
    ) {
      alert('版本不相容')
      return
    }

    const importedShopping: typeof shopping.items =
      (data.schemaVersion === 2 || data.schemaVersion === 3) && Array.isArray(data.shoppingItems)
        ? data.shoppingItems
        : []
    const importedImages: Record<string, { data: string; type: string }> =
      (data.schemaVersion === 2 || data.schemaVersion === 3) &&
      data.images &&
      typeof data.images === 'object'
        ? data.images
        : {}

    const merge = confirm('OK = 合併（保留現有）、取消 = 完全取代')

    // Decide which image ids to restore to IndexedDB.
    let imageIdsToRestore: string[]
    if (!merge) {
      categories.categories = data.categories
      // Replace mode: wipe all existing images first, then restore everything from the bundle.
      await clearAllImages()
      shopping.setAll(importedShopping)
      imageIdsToRestore = Object.keys(importedImages)
    } else {
      const existingCatIds = new Set(categories.categories.map((c) => c.id))
      for (const c of data.categories) if (!existingCatIds.has(c.id)) categories.categories.push(c)
      // Merge mode: only add shopping items whose id is new, and only restore their images.
      const existingShoppingIds = new Set(shopping.items.map((i) => i.id))
      const newShoppingItems = importedShopping.filter((s) => !existingShoppingIds.has(s.id))
      for (const s of newShoppingItems) shopping.items.push(s)
      imageIdsToRestore = [...new Set(newShoppingItems.flatMap((s) => s.imageIds))]
    }

    for (const id of imageIdsToRestore) {
      const entry = importedImages[id]
      if (!entry) continue
      await saveImageWithId(id, base64ToBlob(entry.data, entry.type))
    }

    alert('匯入完成')
  } catch (err) {
    alert('匯入失敗：' + (err as Error).message)
  } finally {
    input.value = ''
  }
}

async function clearShopping() {
  if (!confirm('真的要清除所有購買項目嗎？此操作無法復原。')) return
  if (!confirm('再次確認：購買清單與所有上傳的圖片將消失')) return
  const allImageIds = [...new Set(shopping.items.flatMap((i) => i.imageIds))]
  shopping.setAll([])
  if (allImageIds.length) await deleteImages(allImageIds)
  // Safety net: also wipe any orphans that slipped through earlier flows.
  await clearAllImages()
}

async function clearAll() {
  if (!confirm('真的要清除所有資料嗎？景點、自訂分類、購買清單與圖片都會消失。')) return
  if (!confirm('再次確認：所有資料將消失')) return
  categories.categories = categories.categories.filter((c) => c.isDefault)
  shopping.setAll([])
  await clearAllImages()
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
          <button :class="{ active: tab === 'shopping' }" @click="tab = 'shopping'">購買清單</button>
          <button :class="{ active: tab === 'settings' }" @click="tab = 'settings'">設定</button>
        </nav>

        <div class="content">
          <PlaceList v-if="tab === 'places'" @select="handleSelect" />
          <ShoppingList v-else-if="tab === 'shopping'" />
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
            <button class="danger" @click="clearShopping">清除購買清單</button>
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
