<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useShoppingStore } from '@/stores/shopping'
import { saveImage, deleteImages } from '@/stores/imageStore'
import { compressImage } from '@/composables/useImageCompress'
import ShoppingImageThumb from './ShoppingImageThumb.vue'

const MAX_IMAGES = 5

const props = defineProps<{ open: boolean; editingId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const shopping = useShoppingStore()

const editing = computed(() =>
  props.editingId ? shopping.items.find((i) => i.id === props.editingId) : null,
)

const name = ref('')
const quantity = ref('')
const location = ref('')
const note = ref('')
const imageIds = ref<string[]>([])
const purchased = ref(false)

let originalImageIds: string[] = []
const uploading = ref(false)
const uploadError = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

watch(
  () => props.open,
  (o) => {
    if (!o) return
    if (editing.value) {
      name.value = editing.value.name
      quantity.value = editing.value.quantity ?? ''
      location.value = editing.value.location ?? ''
      note.value = editing.value.note ?? ''
      imageIds.value = [...editing.value.imageIds]
      purchased.value = editing.value.purchased
      originalImageIds = [...editing.value.imageIds]
    } else {
      name.value = ''
      quantity.value = ''
      location.value = ''
      note.value = ''
      imageIds.value = []
      purchased.value = false
      originalImageIds = []
    }
    uploadError.value = ''
  },
)

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (files.length === 0) return

  const remaining = MAX_IMAGES - imageIds.value.length
  if (files.length > remaining) {
    uploadError.value = `最多 ${MAX_IMAGES} 張`
    files.splice(remaining)
    if (files.length === 0) return
  } else {
    uploadError.value = ''
  }

  uploading.value = true
  for (const file of files) {
    try {
      const blob = await compressImage(file)
      const id = await saveImage(blob)
      imageIds.value.push(id)
    } catch (err) {
      console.error('image upload failed', err)
      uploadError.value = '圖片儲存失敗'
    }
  }
  uploading.value = false
}

function removeImage(id: string) {
  imageIds.value = imageIds.value.filter((x) => x !== id)
}

const canSave = computed(() => name.value.trim() !== '')

async function save() {
  if (!canSave.value) return
  const data = {
    name: name.value.trim(),
    quantity: quantity.value.trim() || undefined,
    location: location.value.trim() || undefined,
    note: note.value.trim() || undefined,
    imageIds: [...imageIds.value],
    purchased: purchased.value,
  }
  const removedFromOriginal = originalImageIds.filter((id) => !imageIds.value.includes(id))
  if (editing.value) {
    shopping.update(editing.value.id, data)
  } else {
    shopping.add(data)
  }
  if (removedFromOriginal.length) await deleteImages(removedFromOriginal)
  emit('close')
}

async function cancel() {
  const newlyAdded = imageIds.value.filter((id) => !originalImageIds.includes(id))
  if (newlyAdded.length) await deleteImages(newlyAdded)
  emit('close')
}

async function handleDelete() {
  if (!editing.value) return
  if (!confirm('確定刪除這個項目？')) return
  const id = editing.value.id
  await shopping.remove(id)
  emit('close')
}

onUnmounted(() => {
  // If the component is destroyed without going through cancel/save, clean up newly-uploaded orphans.
  if (props.open) {
    const newlyAdded = imageIds.value.filter((id) => !originalImageIds.includes(id))
    if (newlyAdded.length) void deleteImages(newlyAdded)
  }
})
</script>

<template>
  <div v-if="open" class="backdrop" @click.self="cancel">
    <div class="modal">
      <h2>{{ editing ? '編輯購買項目' : '新增購買項目' }}</h2>

      <label>名稱<span class="req">*</span></label>
      <input v-model="name" placeholder="例：辣牛肉乾" />

      <label>數量</label>
      <input v-model="quantity" placeholder="例：2、1包、半斤" />

      <label>購買地點</label>
      <input v-model="location" placeholder="例：樂天瑪特" />

      <label>備註</label>
      <textarea v-model="note" rows="2" />

      <label>圖片 ({{ imageIds.length }}/{{ MAX_IMAGES }})</label>
      <div class="images">
        <div v-for="id in imageIds" :key="id" class="thumb-wrap">
          <ShoppingImageThumb :image-id="id" />
          <button class="thumb-x" type="button" @click="removeImage(id)" aria-label="移除">×</button>
        </div>
        <label v-if="imageIds.length < MAX_IMAGES" class="add-btn" :class="{ disabled: uploading }">
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            multiple
            :disabled="uploading"
            @change="handleFileChange"
            hidden
          />
          {{ uploading ? '處理中…' : '+ 加圖' }}
        </label>
      </div>
      <p v-if="uploadError" class="err">{{ uploadError }}</p>

      <label class="check">
        <input v-model="purchased" type="checkbox" /> 已購買
      </label>

      <div class="actions">
        <button v-if="editing" class="danger" type="button" @click="handleDelete">刪除</button>
        <span style="flex: 1" />
        <button type="button" @click="cancel">取消</button>
        <button :disabled="!canSave" @click="save" class="primary" type="button">儲存</button>
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
.req { color: #ef4444; margin-left: 2px; }
input[type="text"], input:not([type]), textarea, select {
  width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px;
  box-sizing: border-box; font-size: 1rem;
}
.check { display: flex; align-items: center; gap: 8px; }
.check input { width: auto; }
.err { color: #ef4444; font-size: 0.85rem; margin: 4px 0 0; }
.images {
  display: flex; gap: 8px; overflow-x: auto; padding: 4px 0;
}
.thumb-wrap { position: relative; flex: 0 0 auto; }
.thumb-x {
  position: absolute; top: -6px; right: -6px;
  width: 22px; height: 22px; border-radius: 50%;
  background: #111; color: white; border: 2px solid white;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; padding: 0; line-height: 1; font-size: 14px;
}
.add-btn {
  flex: 0 0 auto;
  display: flex; align-items: center; justify-content: center;
  width: 72px; height: 72px;
  border: 2px dashed #bbb; border-radius: 8px;
  cursor: pointer; color: #555; font-size: 0.85rem; margin: 0;
}
.add-btn.disabled { cursor: not-allowed; opacity: 0.6; }
.actions { display: flex; gap: 8px; align-items: center; margin-top: 16px; }
.actions button { padding: 10px 16px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; }
.actions .primary { background: #3b82f6; color: white; border-color: #3b82f6; }
.actions .primary:disabled { opacity: 0.5; cursor: not-allowed; }
.actions .danger { color: #ef4444; border-color: #fca5a5; }
</style>
