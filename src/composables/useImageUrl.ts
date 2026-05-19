import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import { loadImage } from '@/stores/imageStore'

export function useImageUrl(imageId: Ref<string | null | undefined>) {
  const url = ref<string | null>(null)
  let current: string | null = null

  function revoke() {
    if (current) {
      URL.revokeObjectURL(current)
      current = null
    }
  }

  async function refresh(id: string | null | undefined) {
    revoke()
    url.value = null
    if (!id) return
    const blob = await loadImage(id)
    if (!blob) return
    // ignore if id changed during await
    if (imageId.value !== id) return
    current = URL.createObjectURL(blob)
    url.value = current
  }

  watch(imageId, (id) => void refresh(id), { immediate: true })
  onBeforeUnmount(revoke)

  return { url }
}
