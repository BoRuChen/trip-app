<script setup lang="ts">
import { toRef } from 'vue'
import { useImageUrl } from '@/composables/useImageUrl'

const props = defineProps<{ imageId: string; size?: number }>()
const { url } = useImageUrl(toRef(props, 'imageId'))
</script>

<template>
  <div class="thumb" :style="{ width: (size ?? 72) + 'px', height: (size ?? 72) + 'px' }">
    <img v-if="url" :src="url" alt="" />
    <span v-else class="placeholder">…</span>
  </div>
</template>

<style scoped>
.thumb {
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
}
.thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.placeholder { color: #9ca3af; font-size: 0.8rem; }
</style>
