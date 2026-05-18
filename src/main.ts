import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'leaflet/dist/leaflet.css'
import App from './App.vue'
import { initStores } from './stores'

const app = createApp(App)
app.use(createPinia())
initStores()
app.mount('#app')
