# Busan Trip Map App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first Vue 3 SPA that lets the user record Busan-trip places with category icons on a Leaflet map, parse coordinates from pasted Google Maps URLs, and focus on "nearby" places within 1km of the current GPS location.

**Architecture:** Vue 3 + Pinia + Leaflet, single-page, all state in two Pinia stores (`places`, `categories`) persisted to `localStorage` under key `busan-trip:v1`. The map is full-screen; UI controls float over it. Pure logic (URL parser, persistence serialization, distance math) is TDD'd with Vitest. UI components are wired manually and verified in the dev server.

**Tech Stack:** Vue 3, Vite, TypeScript, Pinia, Leaflet, lucide-vue-next, uuid, Vitest (testing).

**Design reference:** `docs/plans/2026-05-18-busan-trip-map-design.md`

---

## Task 0: Set up Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Step 1: Install Vitest and Vue Test Utils**

Run: `npm install -D vitest @vue/test-utils jsdom`

**Step 2: Add test scripts and config**

Edit `package.json` scripts to include:
```json
"test": "vitest",
"test:run": "vitest run"
```

Create `vitest.config.ts`:
```ts
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
}))
```

**Step 3: Smoke-test it**

Create `src/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('smoke', () => {
  it('runs', () => expect(1 + 1).toBe(2))
})
```

Run: `npm run test:run`
Expected: 1 test passed.

**Step 4: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/__tests__/smoke.test.ts
git commit -m "chore: add Vitest test infrastructure"
```

---

## Task 1: Install runtime dependencies

**Files:** `package.json`

**Step 1: Install**

Run:
```
npm install leaflet pinia lucide-vue-next uuid
npm install -D @types/leaflet @types/uuid
```

**Step 2: Verify versions**

Read `package.json` and confirm `leaflet`, `pinia`, `lucide-vue-next`, `uuid` are in `dependencies`, and the two `@types/*` are in `devDependencies`.

**Step 3: Wire Pinia into `main.ts`**

Replace `src/main.ts` with:
```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'leaflet/dist/leaflet.css'
import App from './App.vue'

createApp(App).use(createPinia()).mount('#app')
```

**Step 4: Verify build still works**

Run: `npm run type-check`
Expected: no errors.

**Step 5: Commit**

```bash
git add package.json package-lock.json src/main.ts
git commit -m "feat: install Leaflet, Pinia, Lucide, uuid"
```

---

## Task 2: Types and constants

**Files:**
- Create: `src/types.ts`
- Create: `src/constants.ts`

**Step 1: Write `src/types.ts`**

```ts
export interface Category {
  id: string
  name: string
  icon: string      // lucide-vue-next component name in kebab-case (e.g. 'utensils')
  color: string     // hex like '#ef4444'
  isDefault: boolean
}

export interface Place {
  id: string
  name: string
  lat: number
  lng: number
  categoryId: string
  note?: string
  sourceUrl?: string
  visited: boolean
  createdAt: number
}

export interface PersistedState {
  schemaVersion: 1
  categories: Category[]
  places: Place[]
}
```

**Step 2: Write `src/constants.ts`**

```ts
import type { Category } from './types'

export const STORAGE_KEY = 'busan-trip:v1'
export const BUSAN_CENTER: [number, number] = [35.1796, 129.0756]
export const DEFAULT_ZOOM = 12
export const NEARBY_RADIUS_M = 1000

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-food',     name: '美食',     icon: 'utensils',      color: '#ef4444', isDefault: true },
  { id: 'cat-cafe',     name: '咖啡甜點', icon: 'coffee',        color: '#a16207', isDefault: true },
  { id: 'cat-sight',    name: '景點',     icon: 'camera',        color: '#3b82f6', isDefault: true },
  { id: 'cat-shop',     name: '購物',     icon: 'shopping-bag',  color: '#ec4899', isDefault: true },
  { id: 'cat-stay',     name: '住宿',     icon: 'bed',           color: '#8b5cf6', isDefault: true },
  { id: 'cat-transit',  name: '交通',     icon: 'train',         color: '#10b981', isDefault: true },
]
```

**Step 3: Commit**

```bash
git add src/types.ts src/constants.ts
git commit -m "feat: add types and constants (default categories, Busan center)"
```

---

## Task 3: Google Maps URL parser (full TDD)

**Files:**
- Create: `src/composables/useMapsUrlParser.ts`
- Create: `src/composables/__tests__/useMapsUrlParser.test.ts`

**Step 1: Write failing tests first**

Create `src/composables/__tests__/useMapsUrlParser.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseMapsInput } from '../useMapsUrlParser'

describe('parseMapsInput', () => {
  it('parses /place/<name>/@lat,lng,zoom URL', () => {
    const r = parseMapsInput('https://www.google.com/maps/place/Gwangalli+Beach/@35.1531,129.1187,17z')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: 'Gwangalli Beach' })
  })

  it('parses ?q=lat,lng URL', () => {
    const r = parseMapsInput('https://www.google.com/maps/?q=35.1531,129.1187')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('parses bare "lat, lng" string', () => {
    const r = parseMapsInput('35.1531, 129.1187')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('parses bare "lat,lng" without space', () => {
    const r = parseMapsInput('35.1531,129.1187')
    expect(r).toEqual({ ok: true, lat: 35.1531, lng: 129.1187, name: undefined })
  })

  it('rejects maps.app.goo.gl short URLs with a helpful message', () => {
    const r = parseMapsInput('https://maps.app.goo.gl/abc123')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toMatch(/short.*url/i)
  })

  it('rejects garbage input', () => {
    const r = parseMapsInput('hello world')
    expect(r.ok).toBe(false)
  })

  it('rejects out-of-range coordinates', () => {
    const r = parseMapsInput('95.0, 200.0')
    expect(r.ok).toBe(false)
  })

  it('decodes URL-encoded place names', () => {
    const r = parseMapsInput('https://www.google.com/maps/place/%EA%B4%91%EC%95%88%EB%A6%AC/@35.15,129.11,17z')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.name).toBe('광안리')
  })
})
```

**Step 2: Run tests, confirm they fail**

Run: `npm run test:run -- useMapsUrlParser`
Expected: all 8 tests fail (module not found).

**Step 3: Write implementation**

Create `src/composables/useMapsUrlParser.ts`:
```ts
export type ParseResult =
  | { ok: true; lat: number; lng: number; name?: string }
  | { ok: false; reason: string }

const isValidLat = (n: number) => Number.isFinite(n) && n >= -90 && n <= 90
const isValidLng = (n: number) => Number.isFinite(n) && n >= -180 && n <= 180

function tryBareCoords(input: string): ParseResult | null {
  const m = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (!isValidLat(lat) || !isValidLng(lng)) {
    return { ok: false, reason: '座標超出有效範圍' }
  }
  return { ok: true, lat, lng }
}

function tryPlaceUrl(input: string): ParseResult | null {
  // https://www.google.com/maps/place/<name>/@lat,lng,zoom
  const m = input.match(/\/maps\/place\/([^/]+)\/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const name = decodeURIComponent(m[1].replace(/\+/g, ' '))
  const lat = parseFloat(m[2])
  const lng = parseFloat(m[3])
  if (!isValidLat(lat) || !isValidLng(lng)) return { ok: false, reason: '座標超出有效範圍' }
  return { ok: true, lat, lng, name }
}

function tryQueryUrl(input: string): ParseResult | null {
  // https://www.google.com/maps/?q=lat,lng or ...&query=lat,lng
  const m = input.match(/[?&](?:q|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const lat = parseFloat(m[1])
  const lng = parseFloat(m[2])
  if (!isValidLat(lat) || !isValidLng(lng)) return { ok: false, reason: '座標超出有效範圍' }
  return { ok: true, lat, lng }
}

export function parseMapsInput(input: string): ParseResult {
  if (!input || !input.trim()) {
    return { ok: false, reason: '輸入為空' }
  }
  if (/maps\.app\.goo\.gl/.test(input)) {
    return { ok: false, reason: '不支援 short URL，請在瀏覽器打開後貼展開的網址' }
  }
  return (
    tryPlaceUrl(input) ??
    tryQueryUrl(input) ??
    tryBareCoords(input) ?? {
      ok: false,
      reason: '無法解析，請貼 Google Maps 連結或座標（如 35.15, 129.11）',
    }
  )
}
```

**Step 4: Run tests, confirm all pass**

Run: `npm run test:run -- useMapsUrlParser`
Expected: 8 tests pass.

**Step 5: Commit**

```bash
git add src/composables/useMapsUrlParser.ts src/composables/__tests__/useMapsUrlParser.test.ts
git commit -m "feat: Google Maps URL parser with full test coverage"
```

---

## Task 4: Persistence layer (TDD)

**Files:**
- Create: `src/stores/persistence.ts`
- Create: `src/stores/__tests__/persistence.test.ts`

**Step 1: Write failing tests**

Create `src/stores/__tests__/persistence.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState } from '../persistence'
import { STORAGE_KEY, DEFAULT_CATEGORIES } from '@/constants'

describe('persistence', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when no data exists', () => {
    expect(loadState()).toBeNull()
  })

  it('round-trips a state object', () => {
    const state = {
      schemaVersion: 1 as const,
      categories: DEFAULT_CATEGORIES,
      places: [{ id: 'p1', name: 'X', lat: 35, lng: 129, categoryId: 'cat-food', visited: false, createdAt: 1 }],
    }
    saveState(state)
    expect(loadState()).toEqual(state)
  })

  it('returns null on corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')
    expect(loadState()).toBeNull()
  })

  it('returns null when schemaVersion is unknown', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 99 }))
    expect(loadState()).toBeNull()
  })
})
```

Also need a vite alias for `@`. Update `vite.config.ts` to add:
```ts
import { fileURLToPath, URL } from 'node:url'
// ... in defineConfig:
resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
```

And add to `tsconfig.app.json` compilerOptions:
```json
"baseUrl": ".",
"paths": { "@/*": ["src/*"] }
```

**Step 2: Run tests, confirm fail**

Run: `npm run test:run -- persistence`
Expected: fails (module not found).

**Step 3: Write implementation**

Create `src/stores/persistence.ts`:
```ts
import type { PersistedState } from '@/types'
import { STORAGE_KEY } from '@/constants'

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    if (parsed.schemaVersion !== 1) return null
    if (!Array.isArray(parsed.categories) || !Array.isArray(parsed.places)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
```

**Step 4: Run tests**

Run: `npm run test:run -- persistence`
Expected: 4 tests pass.

**Step 5: Commit**

```bash
git add vite.config.ts tsconfig.app.json src/stores/persistence.ts src/stores/__tests__/persistence.test.ts
git commit -m "feat: localStorage persistence with version-guarded loader"
```

---

## Task 5: Pinia stores (categories + places)

**Files:**
- Create: `src/stores/categories.ts`
- Create: `src/stores/places.ts`
- Create: `src/stores/index.ts`

**Step 1: Write `categories` store**

Create `src/stores/categories.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Category } from '@/types'
import { DEFAULT_CATEGORIES } from '@/constants'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<Category[]>([...DEFAULT_CATEGORIES])

  function add(input: Omit<Category, 'id' | 'isDefault'>) {
    categories.value.push({ id: uuid(), isDefault: false, ...input })
  }
  function update(id: string, patch: Partial<Omit<Category, 'id' | 'isDefault'>>) {
    const c = categories.value.find((c) => c.id === id)
    if (c) Object.assign(c, patch)
  }
  function remove(id: string) {
    const c = categories.value.find((c) => c.id === id)
    if (!c || c.isDefault) return  // default categories cannot be deleted
    categories.value = categories.value.filter((c) => c.id !== id)
  }
  function byId(id: string) {
    return categories.value.find((c) => c.id === id)
  }

  return { categories, add, update, remove, byId }
})
```

**Step 2: Write `places` store**

Create `src/stores/places.ts`:
```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Place } from '@/types'

export const usePlacesStore = defineStore('places', () => {
  const places = ref<Place[]>([])

  function add(input: Omit<Place, 'id' | 'createdAt'>) {
    places.value.push({ id: uuid(), createdAt: Date.now(), ...input })
  }
  function update(id: string, patch: Partial<Omit<Place, 'id' | 'createdAt'>>) {
    const p = places.value.find((p) => p.id === id)
    if (p) Object.assign(p, patch)
  }
  function remove(id: string) {
    places.value = places.value.filter((p) => p.id !== id)
  }
  function setAll(next: Place[]) {
    places.value = next
  }

  return { places, add, update, remove, setAll }
})
```

**Step 3: Wire persistence in `src/stores/index.ts`**

```ts
import { watch } from 'vue'
import { useCategoriesStore } from './categories'
import { usePlacesStore } from './places'
import { loadState, saveState } from './persistence'

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function initStores() {
  const categories = useCategoriesStore()
  const places = usePlacesStore()

  const loaded = loadState()
  if (loaded) {
    categories.categories = loaded.categories
    places.setAll(loaded.places)
  }

  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveState({
        schemaVersion: 1,
        categories: categories.categories,
        places: places.places,
      })
    }, 300)
  }

  watch(() => categories.categories, persist, { deep: true })
  watch(() => places.places, persist, { deep: true })
}
```

**Step 4: Call `initStores()` from `main.ts`**

Update `src/main.ts`:
```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'leaflet/dist/leaflet.css'
import App from './App.vue'
import { initStores } from './stores'

const app = createApp(App)
app.use(createPinia())
initStores()
app.mount('#app')
```

**Step 5: Verify types**

Run: `npm run type-check`
Expected: no errors.

**Step 6: Commit**

```bash
git add src/stores/
git commit -m "feat: Pinia stores for categories and places with debounced persistence"
```

---

## Task 6: MapView component (basic Leaflet)

**Files:**
- Create: `src/components/MapView.vue`
- Modify: `src/App.vue`

**Step 1: Write `MapView.vue`**

```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import L from 'leaflet'
import { BUSAN_CENTER, DEFAULT_ZOOM } from '@/constants'

const mapEl = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value).setView(BUSAN_CENTER, DEFAULT_ZOOM)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)
})

onUnmounted(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="mapEl" class="map-root" />
</template>

<style scoped>
.map-root { position: fixed; inset: 0; }
</style>
```

**Step 2: Replace `App.vue`**

```vue
<script setup lang="ts">
import MapView from './components/MapView.vue'
</script>

<template>
  <MapView />
</template>

<style>
html, body, #app { margin: 0; height: 100%; }
</style>
```

**Step 3: Run dev server and verify**

Run: `npm run dev`
Open `http://localhost:5173` in browser, confirm Busan map tiles render full-screen with attribution.

**Step 4: Commit**

```bash
git add src/components/MapView.vue src/App.vue
git commit -m "feat: full-screen Leaflet map centered on Busan"
```

---

## Task 7: Markers + bottom sheet

**Files:**
- Create: `src/components/PlaceMarker.ts` (divIcon factory)
- Create: `src/components/PlaceDetailSheet.vue`
- Modify: `src/components/MapView.vue`

**Step 1: Write divIcon factory**

`src/components/PlaceMarker.ts`:
```ts
import L from 'leaflet'
import type { Category } from '@/types'

// Inline SVG strings keyed by lucide name. We avoid runtime-rendering Vue components
// into divIcon HTML — this keeps marker creation cheap.
const ICONS: Record<string, string> = {
  utensils: '<path d="M3 2v7c0 1.1.9 2 2 2h2v9a1 1 0 0 0 2 0V2M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  coffee: '<path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/><line x1="6" x2="6" y1="2" y2="4"/><line x1="10" x2="10" y1="2" y2="4"/><line x1="14" x2="14" y1="2" y2="4"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  'shopping-bag': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  bed: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  train: '<path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/>',
}

export function makePlaceMarker(category: Category, dimmed: boolean): L.DivIcon {
  const svg = ICONS[category.icon] ?? ICONS.camera
  const opacity = dimmed ? 0.3 : 1
  return L.divIcon({
    className: 'place-marker',
    html: `
      <div style="
        width:36px;height:36px;border-radius:50%;
        background:${category.color};opacity:${opacity};
        display:flex;align-items:center;justify-content:center;
        box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid white;">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="white"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${svg}</svg>
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })
}
```

**Step 2: Render markers in MapView**

Update `src/components/MapView.vue` `<script setup>` to add:
```ts
import { computed, watch } from 'vue'
import { usePlacesStore } from '@/stores/places'
import { useCategoriesStore } from '@/stores/categories'
import { makePlaceMarker } from './PlaceMarker'
import type { Place } from '@/types'

const places = usePlacesStore()
const categories = useCategoriesStore()

const selectedPlaceId = ref<string | null>(null)
const markers = new Map<string, L.Marker>()

function syncMarkers() {
  if (!map) return
  const next = new Set(places.places.map((p) => p.id))
  for (const [id, m] of markers) {
    if (!next.has(id)) { m.remove(); markers.delete(id) }
  }
  for (const p of places.places) {
    const cat = categories.byId(p.categoryId)
    if (!cat) continue
    const icon = makePlaceMarker(cat, p.visited)
    const existing = markers.get(p.id)
    if (existing) {
      existing.setLatLng([p.lat, p.lng])
      existing.setIcon(icon)
    } else {
      const m = L.marker([p.lat, p.lng], { icon })
        .addTo(map)
        .on('click', () => (selectedPlaceId.value = p.id))
      markers.set(p.id, m)
    }
  }
}

watch(() => [places.places, categories.categories], syncMarkers, { deep: true })
// In onMounted, after creating map, call syncMarkers()
```

Expose `selectedPlaceId` and `places.byId-equivalent` to the sheet.

**Step 3: Write `PlaceDetailSheet.vue`**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { usePlacesStore } from '@/stores/places'
import { useCategoriesStore } from '@/stores/categories'

const props = defineProps<{ placeId: string | null }>()
const emit = defineEmits<{ close: []; edit: [id: string] }>()

const places = usePlacesStore()
const categories = useCategoriesStore()

const place = computed(() => places.places.find((p) => p.id === props.placeId))
const category = computed(() => place.value && categories.byId(place.value.categoryId))

function openInGoogleMaps() {
  if (!place.value) return
  window.open(`https://www.google.com/maps/search/?api=1&query=${place.value.lat},${place.value.lng}`, '_blank')
}
function toggleVisited() {
  if (place.value) places.update(place.value.id, { visited: !place.value.visited })
}
function remove() {
  if (place.value && confirm(`刪除「${place.value.name}」？`)) {
    places.remove(place.value.id)
    emit('close')
  }
}
</script>

<template>
  <div v-if="place" class="sheet">
    <header>
      <span class="cat-chip" :style="{ background: category?.color }">{{ category?.name }}</span>
      <h2>{{ place.name }}</h2>
      <button @click="emit('close')" aria-label="關閉">✕</button>
    </header>
    <p v-if="place.note" class="note">{{ place.note }}</p>
    <div class="actions">
      <button @click="toggleVisited">{{ place.visited ? '標記為未去' : '標記已去過' }}</button>
      <button @click="openInGoogleMaps">用 Google Maps 開啟</button>
      <button @click="emit('edit', place.id)">編輯</button>
      <button class="danger" @click="remove">刪除</button>
    </div>
  </div>
</template>

<style scoped>
.sheet {
  position: fixed; left: 0; right: 0; bottom: 0;
  background: white; border-radius: 16px 16px 0 0;
  padding: 16px; box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
  z-index: 1000;
}
header { display: flex; align-items: center; gap: 8px; }
header h2 { flex: 1; margin: 0; font-size: 1.1rem; }
header button { background: none; border: none; font-size: 1.2rem; cursor: pointer; }
.cat-chip { color: white; padding: 2px 8px; border-radius: 999px; font-size: 0.85rem; }
.note { color: #555; margin: 12px 0; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.actions button { padding: 8px 12px; border: 1px solid #ddd; background: white; border-radius: 8px; cursor: pointer; }
.actions .danger { color: #ef4444; border-color: #ef4444; }
</style>
```

**Step 4: Mount sheet in `App.vue`**

```vue
<script setup lang="ts">
import { ref, provide } from 'vue'
import MapView from './components/MapView.vue'
import PlaceDetailSheet from './components/PlaceDetailSheet.vue'

const selectedPlaceId = ref<string | null>(null)
provide('selectedPlaceId', selectedPlaceId)
</script>

<template>
  <MapView v-model:selectedPlaceId="selectedPlaceId" />
  <PlaceDetailSheet :placeId="selectedPlaceId" @close="selectedPlaceId = null" @edit="/* TODO Task 8 */" />
</template>
```

And expose `selectedPlaceId` as a `v-model` on `MapView` using `defineModel`.

**Step 5: Verify in browser**

Run: `npm run dev`. Seed a place via DevTools:
```js
const ps = window.__pinia_places_store__ // optional debug hook OR use store directly
```
Easier: add 1 hardcoded place temporarily in store init to verify marker + sheet — then remove before commit.

**Step 6: Commit**

```bash
git add src/components/PlaceMarker.ts src/components/PlaceDetailSheet.vue src/components/MapView.vue src/App.vue
git commit -m "feat: render category-styled markers and bottom detail sheet"
```

---

## Task 8: Add / edit place modal

**Files:**
- Create: `src/components/AddPlaceModal.vue`
- Modify: `src/App.vue`

**Step 1: Write modal**

```vue
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { parseMapsInput } from '@/composables/useMapsUrlParser'
import { usePlacesStore } from '@/stores/places'
import { useCategoriesStore } from '@/stores/categories'
import type { Place } from '@/types'

const props = defineProps<{ open: boolean; editingId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const places = usePlacesStore()
const categories = useCategoriesStore()

const editing = computed(() => props.editingId ? places.places.find(p => p.id === props.editingId) : null)

const urlInput = ref('')
const name = ref('')
const lat = ref<number | null>(null)
const lng = ref<number | null>(null)
const categoryId = ref(categories.categories[0]?.id ?? '')
const note = ref('')
const visited = ref(false)
const parseError = ref('')

watch(() => props.open, (o) => {
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
    urlInput.value = ''; name.value = ''; lat.value = null; lng.value = null
    categoryId.value = categories.categories[0]?.id ?? ''
    note.value = ''; visited.value = false
  }
  parseError.value = ''
})

function handleUrlInput() {
  if (!urlInput.value.trim()) return
  const r = parseMapsInput(urlInput.value)
  if (r.ok) {
    lat.value = r.lat; lng.value = r.lng
    if (r.name && !name.value) name.value = r.name
    parseError.value = ''
  } else {
    parseError.value = r.reason
  }
}

const canSave = computed(() =>
  name.value.trim() && lat.value !== null && lng.value !== null && categoryId.value
)

function save() {
  if (!canSave.value || lat.value === null || lng.value === null) return
  const data = {
    name: name.value.trim(),
    lat: lat.value, lng: lng.value,
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
      <input v-model="urlInput" @blur="handleUrlInput" @paste="setTimeout(handleUrlInput, 0)" placeholder="https://www.google.com/maps/place/..." />
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

      <label class="check"><input v-model="visited" type="checkbox" /> 已去過</label>

      <div class="actions">
        <button @click="emit('close')">取消</button>
        <button :disabled="!canSave" @click="save" class="primary">儲存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; justify-content: center; z-index: 2000; }
.modal { width: 100%; max-width: 480px; background: white; border-radius: 16px 16px 0 0; padding: 16px; max-height: 90vh; overflow-y: auto; }
.modal h2 { margin: 0 0 12px; }
label { display: block; margin: 12px 0 4px; font-size: 0.9rem; color: #555; }
input, textarea, select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 1rem; }
.coords { display: flex; gap: 8px; } .coords input { flex: 1; }
.check { display: flex; align-items: center; gap: 8px; } .check input { width: auto; }
.err { color: #ef4444; font-size: 0.85rem; margin: 4px 0 0; }
.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
.actions button { padding: 10px 16px; border: 1px solid #ddd; background: white; border-radius: 8px; }
.actions .primary { background: #3b82f6; color: white; border-color: #3b82f6; }
.actions .primary:disabled { opacity: 0.5; }
</style>
```

**Step 2: Wire into `App.vue`**

Add a `＋` FAB and modal:
```vue
<button class="fab-add" @click="openAdd">＋</button>
<AddPlaceModal :open="modalOpen" :editingId="editingId" @close="closeModal" />
```

With state `modalOpen` and `editingId`; sheet's `@edit` opens modal in edit mode.

**Step 3: Verify in browser**

`npm run dev`. Test: paste a real Google Maps URL (e.g. Gwangalli beach), confirm coords + name autofill, save, marker appears, click marker → sheet → edit → modal pre-filled.

**Step 4: Commit**

```bash
git add src/components/AddPlaceModal.vue src/App.vue
git commit -m "feat: add/edit place modal with URL parsing"
```

---

## Task 9: Geolocation + 1km nearby focus

**Files:**
- Create: `src/composables/useGeolocation.ts`
- Modify: `src/components/MapView.vue`

**Step 1: Write geolocation composable**

```ts
// src/composables/useGeolocation.ts
import { ref } from 'vue'

export function useGeolocation() {
  const position = ref<{ lat: number; lng: number } | null>(null)
  const error = ref<string | null>(null)
  const loading = ref(false)

  function locate(): Promise<{ lat: number; lng: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        error.value = '此瀏覽器不支援定位'
        resolve(null); return
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
```

**Step 2: Add nearby logic to MapView**

Add to MapView script:
```ts
import { useGeolocation } from '@/composables/useGeolocation'
import { NEARBY_RADIUS_M } from '@/constants'

const geo = useGeolocation()
let userMarker: L.CircleMarker | null = null
let radiusCircle: L.Circle | null = null
const nearbyActive = ref(false)

function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

async function activateNearby() {
  const pos = await geo.locate()
  if (!pos || !map) {
    if (geo.error.value) alert(geo.error.value)
    return
  }
  map.setView([pos.lat, pos.lng], 15)
  if (userMarker) userMarker.remove()
  userMarker = L.circleMarker([pos.lat, pos.lng], {
    radius: 8, color: '#fff', weight: 2, fillColor: '#3b82f6', fillOpacity: 1,
  }).addTo(map)
  if (radiusCircle) radiusCircle.remove()
  radiusCircle = L.circle([pos.lat, pos.lng], {
    radius: NEARBY_RADIUS_M, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1,
  }).addTo(map)
  nearbyActive.value = true
  syncMarkers()
}
```

Modify `syncMarkers` to use `nearbyActive` + distance from `geo.position.value` for `dimmed` flag in `makePlaceMarker`.

Add to template:
```vue
<button class="fab-locate" @click="activateNearby" aria-label="定位">⊕</button>
```

**Step 3: Test on mobile**

`npm run dev -- --host`. On phone (same WiFi), open `http://<computer-ip>:5173`. Note: geolocation requires HTTPS on most browsers except `localhost`. For real phone testing use `vite-plugin-mkcert` later, OR for now test in desktop Chrome with DevTools → Sensors → set custom location near a place.

**Step 4: Commit**

```bash
git add src/composables/useGeolocation.ts src/components/MapView.vue
git commit -m "feat: locate user and visually focus on places within 1km"
```

---

## Task 10: Side drawer + place list + category manager + export/import

This is the biggest task; split into substeps but one commit.

**Files:**
- Create: `src/components/SideDrawer.vue`
- Create: `src/components/PlaceList.vue`
- Create: `src/components/CategoryManager.vue`
- Modify: `src/App.vue` (add ☰ button and drawer mount)

**Step 1: Drawer shell**

`SideDrawer.vue` — backdrop + slide-in panel with tabbed sections (景點列表 / 分類管理 / 匯出匯入).

**Step 2: Place list**

`PlaceList.vue` — grouped by category, expandable; click row → emit `select` to focus on map and open sheet. Include text search input filtering by name + note.

**Step 3: Category manager**

`CategoryManager.vue` — list categories with name + color swatch + icon preview. For each: rename inline, color picker (`<input type="color">`), icon dropdown (limited to the 6 keys defined in `PlaceMarker.ts`'s ICONS map for now). Custom categories have a delete button; default ones don't.

**Step 4: Export / import**

```ts
function exportJson() {
  const blob = new Blob([JSON.stringify({ schemaVersion: 1, categories: categories.categories, places: places.places }, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `busan-trip-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

async function importJson(file: File) {
  const text = await file.text()
  const data = JSON.parse(text)
  if (data.schemaVersion !== 1) { alert('版本不相容'); return }
  const mode = confirm('OK = 合併、取消 = 覆蓋') ? 'merge' : 'replace'
  if (mode === 'replace') {
    categories.categories = data.categories
    places.setAll(data.places)
  } else {
    const existingPlaceIds = new Set(places.places.map(p => p.id))
    for (const p of data.places) if (!existingPlaceIds.has(p.id)) places.places.push(p)
    const existingCatIds = new Set(categories.categories.map(c => c.id))
    for (const c of data.categories) if (!existingCatIds.has(c.id)) categories.categories.push(c)
  }
}
```

**Step 5: Browser test all flows**

`npm run dev`. Add 2 places, export → confirm file downloaded. Clear localStorage in DevTools, refresh → empty. Import the file → places + categories return. Add a custom category → assign a place to it → verify on map. Delete the custom category → verify it cannot delete defaults.

**Step 6: Commit**

```bash
git add src/components/SideDrawer.vue src/components/PlaceList.vue src/components/CategoryManager.vue src/App.vue
git commit -m "feat: side drawer with place list, category manager, export/import"
```

---

## Final verification

**Step 1: Type check**

Run: `npm run type-check`
Expected: no errors.

**Step 2: All tests pass**

Run: `npm run test:run`
Expected: all green.

**Step 3: Production build**

Run: `npm run build`
Expected: no errors. Inspect bundle size — should be under 500KB gzipped (Leaflet ~40KB, Vue ~35KB, Pinia ~10KB, Lucide tree-shakes).

**Step 4: Smoke test the built app**

Run: `npm run preview`
Open in browser, run through full flow: add place via URL, mark visited, locate (use DevTools sensors), edit, export, delete.

**Step 5: Final commit (if any cleanup needed) and push**

```bash
git push origin master
```

---

## Notes for the implementer

- **TDD discipline**: Tasks 3 and 4 require strict TDD (write test → run fail → implement → run pass → commit). For UI tasks (6–10), prefer manual browser verification.
- **One commit per task** keeps history readable; if a task feels too big, split it.
- **Don't gold-plate**: no animations, no toast library, no router. Plain `alert()` and `confirm()` are fine for v1.
- **iOS Safari quirk**: Geolocation requires user gesture AND https (localhost OK). If testing on phone via WiFi later, need https — use `vite-plugin-mkcert` then.
- **YAGNI guard**: if tempted to add multi-trip, login, offline PWA, photo upload — stop and check with user first.