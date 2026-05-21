import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import 'leaflet/dist/leaflet.css'
import App from './App.vue'
import { initStores } from './stores'
import { useAuthStore } from './stores/auth'
import { usePlacesStore } from './stores/places'

const app = createApp(App)
app.use(createPinia())
initStores()

const auth = useAuthStore()
const places = usePlacesStore()

watch(
  () => auth.status,
  async (s) => {
    if (s === 'authed' && auth.user) {
      await places.loadFromCloud(auth.user.id)
      places.subscribe(auth.user.id)
    } else if (s === 'anon') {
      places.reset()
    }
  },
)

auth.init()
app.mount('#app')
