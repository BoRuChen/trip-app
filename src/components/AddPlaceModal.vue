<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { parseMapsInput } from '@/composables/useMapsUrlParser'
import { usePlacesStore } from '@/stores/places'
import { useCategoriesStore } from '@/stores/categories'

const props = defineProps<{ open: boolean; editingId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const places = usePlacesStore()
const categories = useCategoriesStore()

const editing = computed(() =>
  props.editingId ? places.places.find((p) => p.id === props.editingId) : null,
)

const urlInput = ref('')
const name = ref('')
const lat = ref<number | null>(null)
const lng = ref<number | null>(null)
const categoryId = ref(categories.categories[0]?.id ?? '')
const note = ref('')
const visited = ref(false)
const parseError = ref('')

watch(
  () => props.open,
  (o) => {
    if (!o) return
    if (editing.value) {
      urlInput.value = editing.value.sourceUrl ?? ''
      name.value = editing.value.name
      lat.value = editing.value.lat
      lng.value = editing.value.lng
      categoryId.value = editing.value.categoryId
      note.value = editing.value.note ?? ''
      visited.value = editing.value.visited
    } else {
      urlInput.value = ''
      name.value = ''
      lat.value = null
      lng.value = null
      categoryId.value = categories.categories[0]?.id ?? ''
      note.value = ''
      visited.value = false
    }
    parseError.value = ''
  },
)

const isResolving = ref(false)

async function handleUrlInput() {
  if (!urlInput.value.trim()) return
  const currentInput = urlInput.value
  isResolving.value = true
  parseError.value = ''
  try {
    const r = await parseMapsInput(currentInput)
    // Ignore stale results if user edited the input while we awaited
    if (urlInput.value !== currentInput) return
    if (r.ok) {
      lat.value = r.lat
      lng.value = r.lng
      if (r.name && !name.value) name.value = r.name
    } else {
      parseError.value = r.reason
    }
  } finally {
    if (urlInput.value === currentInput) isResolving.value = false
  }
}

function handlePaste() {
  // Defer to next tick so the v-model has the pasted value
  setTimeout(handleUrlInput, 0)
}

const canSave = computed(
  () =>
    name.value.trim() !== '' &&
    lat.value !== null &&
    lng.value !== null &&
    categoryId.value !== '',
)

function save() {
  if (!canSave.value || lat.value === null || lng.value === null) return
  const data = {
    name: name.value.trim(),
    lat: lat.value,
    lng: lng.value,
    categoryId: categoryId.value,
    note: note.value.trim() || undefined,
    sourceUrl: urlInput.value.trim() || undefined,
    visited: visited.value,
  }
  if (editing.value) places.update(editing.value.id, data)
  else places.add(data)
  emit('close')
}
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="emit('close')">
    <div class="modal">
      <h2>{{ editing ? '編輯景點' : '新增景點' }}</h2>

      <label>Google Maps 連結（或 lat,lng）</label>
      <input
        v-model="urlInput"
        @blur="handleUrlInput"
        @paste="handlePaste"
        placeholder="https://www.google.com/maps/place/..."
      />
      <p v-if="isResolving" class="hint">解析短網址中…</p>
      <p v-if="parseError" class="err">{{ parseError }}</p>

      <label>名稱</label>
      <input v-model="name" />

      <label>座標</label>
      <div class="coords">
        <input v-model.number="lat" type="number" step="any" placeholder="lat" />
        <input v-model.number="lng" type="number" step="any" placeholder="lng" />
      </div>

      <label>分類</label>
      <select v-model="categoryId">
        <option v-for="c in categories.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
      </select>

      <label>備註</label>
      <textarea v-model="note" rows="2" />

      <label class="check">
        <input v-model="visited" type="checkbox" /> 已去過
      </label>

      <div class="actions">
        <button @click="emit('close')">取消</button>
        <button :disabled="!canSave" @click="save" class="primary">儲存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 2000;
}
.modal {
  width: 100%;
  max-width: 480px;
  background: white;
  border-radius: 16px 16px 0 0;
  padding: 16px;
  max-height: 90vh;
  overflow-y: auto;
}
.modal h2 { margin: 0 0 12px; }
label { display: block; margin: 12px 0 4px; font-size: 0.9rem; color: #555; }
input, textarea, select {
  width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;
  box-sizing: border-box; font-size: 1rem;
}
.coords { display: flex; gap: 8px; }
.coords input { flex: 1; }
.check { display: flex; align-items: center; gap: 8px; }
.check input { width: auto; }
.err { color: #ef4444; font-size: 0.85rem; margin: 4px 0 0; }
.hint { color: #6b7280; font-size: 0.85rem; margin: 4px 0 0; }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.actions button { padding: 10px 16px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; }
.actions .primary { background: #3b82f6; color: white; border-color: #3b82f6; }
.actions .primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
