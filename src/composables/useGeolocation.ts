import { ref } from 'vue'

export function useGeolocation() {
  const position = ref<{ lat: number; lng: number } | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  function locate(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        error.value = '此瀏覽器不支援定位'
        resolve(null)
        return
      }
      loading.value = true
      navigator.geolocation.getCurrentPosition(
        (p) => {
          loading.value = false
          position.value = { lat: p.coords.latitude, lng: p.coords.longitude }
          error.value = null
          resolve(position.value)
        },
        (e) => {
          loading.value = false
          error.value = e.code === e.PERMISSION_DENIED ? '請允許定位權限' : '無法取得位置'
          resolve(null)
        },
        { enableHighAccuracy: true, timeout: 10000 },
      )
    })
  }

  return { position, error, loading, locate }
}
