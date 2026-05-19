<script setup lang="ts">
import { computed } from 'vue'
import type { ShoppingItem } from '@/types'
import ShoppingImageThumb from './ShoppingImageThumb.vue'

const props = defineProps<{ item: ShoppingItem }>()
const emit = defineEmits<{ edit: [id: string]; toggle: [id: string] }>()

const subtitle = computed(() => {
  const parts: string[] = []
  if (props.item.quantity) parts.push(`× ${props.item.quantity}`)
  if (props.item.location) parts.push(props.item.location)
  return parts.join(' · ')
})
</script>

<template>
  <div class="row" :class="{ done: item.purchased }">
    <div class="thumb">
      <ShoppingImageThumb v-if="item.imageIds[0]" :image-id="item.imageIds[0]" :size="48" />
      <div v-else class="no-img" />
    </div>
    <button class="body" @click="emit('edit', item.id)">
      <span class="name">{{ item.name }}</span>
      <span v-if="subtitle" class="sub">{{ subtitle }}</span>
    </button>
    <input
      class="check"
      type="checkbox"
      :checked="item.purchased"
      @change="emit('toggle', item.id)"
      :aria-label="item.purchased ? '取消已購' : '標記已購'"
    />
  </div>
</template>

<style scoped>
.row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 4px; border-bottom: 1px solid #f0f0f0;
}
.row.done .name { text-decoration: line-through; color: #888; }
.row.done .sub { color: #aaa; }
.row.done { opacity: 0.7; }
.thumb { flex: 0 0 auto; }
.no-img {
  width: 48px; height: 48px; border-radius: 8px;
  background: #f3f4f6; border: 1px dashed #e5e7eb;
}
.body {
  flex: 1; min-width: 0; text-align: left; background: none; border: none;
  cursor: pointer; padding: 4px; display: flex; flex-direction: column; gap: 2px;
}
.name { font-size: 0.95rem; }
.sub { font-size: 0.8rem; color: #666; }
.check { width: 22px; height: 22px; flex: 0 0 auto; cursor: pointer; }
</style>
