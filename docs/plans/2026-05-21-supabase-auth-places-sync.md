# Supabase 登入 + 景點雲端同步 實作計畫

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 加入 Supabase Email + 密碼登入，景點 (places) 改為雲端為主、Realtime 多裝置同步；購物清單與分類維持本地。

**Architecture:** Cloud-first：未登入無法使用景點 tab；登入後 places 全部從 Supabase 載入並訂閱 Realtime 推播；mutations 採 optimistic update + 失敗 revert。Categories 與 shoppingItems 持久化邏輯不變，仍走 localStorage / IndexedDB。

**Tech Stack:** Vue 3 + Pinia + Vite + Vitest + `@supabase/supabase-js` v2。

**設計依據：** `docs/plans/2026-05-21-supabase-auth-places-sync-design.md`。

**重要前置注意事項：** 本計畫的 schema migration v2→v3 會**丟棄**本機既有的 places（已上線使用者請先用「匯出 JSON 備份」匯出，登入雲端後手動再加）。

---

## Task 1: 建立 Supabase 專案與 schema（手動，無 code）

**動作（在 Supabase Dashboard 操作）：**

1. 在 https://supabase.com 建立新專案，記下：
   - Project URL（形如 `https://xxxxx.supabase.co`）
   - `anon` public key
2. **Authentication → Providers → Email**：確認 Email provider 已啟用。
3. **SQL Editor** 執行：

```sql
create table public.places (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  category_id text not null,
  note text,
  source_url text,
  visited boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null
);

create index places_user_idx on public.places (user_id);

alter publication supabase_realtime add table public.places;

alter table public.places enable row level security;

create policy "own places - all" on public.places
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

4. **Database → Replication → supabase_realtime**：確認 `places` 表已勾選。

**驗證：** 建立一個測試帳號（**Authentication → Users → Add user**），用 SQL editor 跑 `select * from places where user_id = '<uid>'`，應該回傳 0 列且無權限錯誤。

---

## Task 2: 加入依賴與環境變數

**Step 1：安裝依賴**

```bash
npm install @supabase/supabase-js
```

**Step 2：新增 `.env.local`（不進 git）**

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

**Step 3：新增 `.env.example`（可進 git）**

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

**Step 4：確認 `.gitignore` 已含 `.env.local`**

```bash
grep -q '.env.local' .gitignore || echo '.env.local' >> .gitignore
```

**Step 5：Commit**

```bash
git add package.json package-lock.json .env.example .gitignore
git commit -m "feat(deps): add @supabase/supabase-js and env vars"
```

---

## Task 3: 建立 Supabase client 單例

**Files:**
- Create: `src/lib/supabase.ts`

**Step 1：建立檔案**

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in values.',
  )
}

export const supabase = createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
})
```

**Step 2：型別檢查通過**

Run: `npm run type-check`
Expected: PASS（無新錯誤）

**Step 3：Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat(lib): add Supabase client singleton"
```

---

## Task 4: 更新 `Place` 型別與 `PersistedState` schema 升級

**Files:**
- Modify: `src/types.ts`

**Step 1：修改 `src/types.ts`**

```ts
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
  updatedAt: number   // NEW: ms timestamp, set on add/update
}

export interface PersistedState {
  schemaVersion: 3      // bumped from 2
  categories: Category[]
  shoppingItems: ShoppingItem[]
  // NOTE: places removed — now stored in Supabase
}
```

**Step 2：型別檢查（預期失敗，提示後續 task 要修哪裡）**

Run: `npm run type-check`
Expected: FAIL（會列出 places.ts、persistence.ts、index.ts、SideDrawer.vue 等仍引用舊欄位的地方）。把錯誤訊息看一下，後續 task 會逐一修復。

**Step 3：不 commit。** 留到 Task 5–6 一起 commit（型別與 persistence 是一組 atomic change）。

---

## Task 5: 改寫 `persistence.ts` 與測試（drop places, v2→v3 migration）

**Files:**
- Modify: `src/stores/persistence.ts`
- Modify: `src/stores/__tests__/persistence.test.ts`

**Step 1：先改測試（TDD）**

把 `src/stores/__tests__/persistence.test.ts` 整個取代為：

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { loadState, saveState } from '../persistence'
import { STORAGE_KEY, DEFAULT_CATEGORIES } from '@/constants'

describe('persistence', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when no data exists', () => {
    expect(loadState()).toBeNull()
  })

  it('round-trips a v3 state object (no places field)', () => {
    const state = {
      schemaVersion: 3 as const,
      categories: DEFAULT_CATEGORIES,
      shoppingItems: [{ id: 's1', name: 'kimchi', imageIds: [], purchased: false, createdAt: 2 }],
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

  it('migrates v2 by dropping places (cloud-first migration)', () => {
    const v2 = {
      schemaVersion: 2,
      categories: DEFAULT_CATEGORIES,
      places: [{ id: 'p1', name: 'X', lat: 35, lng: 129, categoryId: 'cat-food', visited: false, createdAt: 1 }],
      shoppingItems: [{ id: 's1', name: 'k', imageIds: [], purchased: false, createdAt: 2 }],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v2))
    const loaded = loadState()
    expect(loaded?.schemaVersion).toBe(3)
    expect(loaded?.categories).toEqual(v2.categories)
    expect(loaded?.shoppingItems).toEqual(v2.shoppingItems)
    expect((loaded as unknown as { places?: unknown }).places).toBeUndefined()
  })

  it('migrates v1 by adding empty shoppingItems and dropping places', () => {
    const v1 = {
      schemaVersion: 1,
      categories: DEFAULT_CATEGORIES,
      places: [{ id: 'p1', name: 'X', lat: 35, lng: 129, categoryId: 'cat-food', visited: false, createdAt: 1 }],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v1))
    const loaded = loadState()
    expect(loaded?.schemaVersion).toBe(3)
    expect(loaded?.categories).toEqual(v1.categories)
    expect(loaded?.shoppingItems).toEqual([])
    expect((loaded as unknown as { places?: unknown }).places).toBeUndefined()
  })
})
```

**Step 2：執行測試確認 fail**

Run: `npm run test:run -- persistence`
Expected: FAIL（舊 `persistence.ts` 仍回 schemaVersion 2 並含 places）。

**Step 3：改寫 `src/stores/persistence.ts`**

```ts
import type { PersistedState } from '@/types'
import { STORAGE_KEY } from '@/constants'

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (!Array.isArray(parsed.categories)) return null

    if (parsed.schemaVersion === 3) {
      if (!Array.isArray(parsed.shoppingItems)) return null
      return parsed as PersistedState
    }
    if (parsed.schemaVersion === 2) {
      if (!Array.isArray(parsed.shoppingItems)) return null
      return {
        schemaVersion: 3,
        categories: parsed.categories,
        shoppingItems: parsed.shoppingItems,
      }
    }
    if (parsed.schemaVersion === 1) {
      return {
        schemaVersion: 3,
        categories: parsed.categories,
        shoppingItems: [],
      }
    }
    return null
  } catch {
    return null
  }
}

export function saveState(state: PersistedState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
```

**Step 4：執行測試確認 pass**

Run: `npm run test:run -- persistence`
Expected: PASS（6 個測試全綠）。

**Step 5：暫不 commit。** Task 6 一起 commit。

---

## Task 6: 更新 `stores/index.ts`（不再從 localStorage 載入 places）

**Files:**
- Modify: `src/stores/index.ts`

**Step 1：取代為**

```ts
import { watch } from 'vue'
import { useCategoriesStore } from './categories'
import { useShoppingStore } from './shopping'
import { loadState, saveState } from './persistence'

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function initStores() {
  const categories = useCategoriesStore()
  const shopping = useShoppingStore()

  const loaded = loadState()
  if (loaded) {
    categories.categories = loaded.categories
    shopping.setAll(loaded.shoppingItems)
  }

  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveState({
        schemaVersion: 3,
        categories: categories.categories,
        shoppingItems: shopping.items,
      })
    }, 300)
  }

  watch(() => categories.categories, persist, { deep: true })
  watch(() => shopping.items, persist, { deep: true })
}
```

**Step 2：型別檢查**

Run: `npm run type-check`
Expected: 仍會在 `places.ts`、`SideDrawer.vue`（exportJson/importJson 處理 places）等地方報錯。**Task 7 之後一次解決。**

**Step 3：Commit（type、persistence、index 一起）**

```bash
git add src/types.ts src/stores/persistence.ts src/stores/index.ts src/stores/__tests__/persistence.test.ts
git commit -m "feat(types,store): bump schema to v3, drop places from local persistence"
```

註：此 commit 後 `npm run type-check` 仍有錯（places.ts 等檔案未改），這是預期的，Task 9 完成後會 clean。

---

## Task 7: Auth store 測試

**Files:**
- Create: `src/stores/__tests__/auth.test.ts`

**Step 1：建立測試（先寫一份覆蓋初始化分支與 sign in/out）**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock supabase client — must be hoisted before importing the store.
const getSessionMock = vi.fn()
const onAuthStateChangeMock = vi.fn()
const signInWithPasswordMock = vi.fn()
const signUpMock = vi.fn()
const signOutMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => getSessionMock(),
      onAuthStateChange: (cb: unknown) => onAuthStateChangeMock(cb),
      signInWithPassword: (args: unknown) => signInWithPasswordMock(args),
      signUp: (args: unknown) => signUpMock(args),
      signOut: () => signOutMock(),
    },
  },
}))

import { useAuthStore } from '../auth'

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    getSessionMock.mockReset()
    onAuthStateChangeMock.mockReset()
    signInWithPasswordMock.mockReset()
    signUpMock.mockReset()
    signOutMock.mockReset()
    onAuthStateChangeMock.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  })

  it('init() with no session sets status=anon', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null })
    const store = useAuthStore()
    await store.init()
    expect(store.status).toBe('anon')
    expect(store.user).toBeNull()
  })

  it('init() with existing session sets status=authed and user', async () => {
    const session = { user: { id: 'u1', email: 'a@b.c' } }
    getSessionMock.mockResolvedValue({ data: { session }, error: null })
    const store = useAuthStore()
    await store.init()
    expect(store.status).toBe('authed')
    expect(store.user?.id).toBe('u1')
  })

  it('init() failure sets status=error', async () => {
    getSessionMock.mockRejectedValue(new Error('boom'))
    const store = useAuthStore()
    await store.init()
    expect(store.status).toBe('error')
    expect(store.errorMessage).toContain('boom')
  })

  it('signIn() success updates user/status', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null })
    const session = { user: { id: 'u1', email: 'a@b.c' } }
    signInWithPasswordMock.mockResolvedValue({ data: { session, user: session.user }, error: null })
    const store = useAuthStore()
    await store.init()
    await store.signIn('a@b.c', 'pw')
    expect(store.user?.id).toBe('u1')
    expect(store.status).toBe('authed')
  })

  it('signIn() failure sets errorMessage and keeps status=anon', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null })
    signInWithPasswordMock.mockResolvedValue({ data: { session: null, user: null }, error: { message: 'bad creds' } })
    const store = useAuthStore()
    await store.init()
    await store.signIn('a@b.c', 'pw')
    expect(store.status).toBe('anon')
    expect(store.errorMessage).toBe('bad creds')
  })

  it('signOut() clears user and sets status=anon', async () => {
    const session = { user: { id: 'u1', email: 'a@b.c' } }
    getSessionMock.mockResolvedValue({ data: { session }, error: null })
    signOutMock.mockResolvedValue({ error: null })
    const store = useAuthStore()
    await store.init()
    expect(store.status).toBe('authed')
    await store.signOut()
    expect(store.status).toBe('anon')
    expect(store.user).toBeNull()
  })
})
```

**Step 2：執行測試確認 fail**

Run: `npm run test:run -- auth`
Expected: FAIL（檔案不存在）。

---

## Task 8: Auth store 實作

**Files:**
- Create: `src/stores/auth.ts`

**Step 1：實作**

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'authed' | 'anon' | 'error'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const session = ref<Session | null>(null)
  const status = ref<AuthStatus>('loading')
  const errorMessage = ref<string | null>(null)

  function applySession(s: Session | null) {
    session.value = s
    user.value = s?.user ?? null
    status.value = s ? 'authed' : 'anon'
  }

  async function init() {
    status.value = 'loading'
    errorMessage.value = null
    try {
      const { data } = await supabase.auth.getSession()
      applySession(data.session)
      supabase.auth.onAuthStateChange((_event, s) => {
        applySession(s)
      })
    } catch (e) {
      status.value = 'error'
      errorMessage.value = (e as Error).message
    }
  }

  async function signIn(email: string, password: string) {
    errorMessage.value = null
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      errorMessage.value = error.message
      return
    }
    applySession(data.session)
  }

  async function signUp(email: string, password: string) {
    errorMessage.value = null
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) errorMessage.value = error.message
  }

  async function signOut() {
    errorMessage.value = null
    const { error } = await supabase.auth.signOut()
    if (error) {
      errorMessage.value = error.message
      return
    }
    applySession(null)
  }

  return { user, session, status, errorMessage, init, signIn, signUp, signOut }
})
```

**Step 2：執行測試確認 pass**

Run: `npm run test:run -- auth`
Expected: PASS（6 個測試）。

**Step 3：Commit**

```bash
git add src/stores/auth.ts src/stores/__tests__/auth.test.ts
git commit -m "feat(store): add auth store with Supabase email/password"
```

---

## Task 9: Places store 測試

**Files:**
- Create: `src/stores/__tests__/places.test.ts`

**Step 1：建立測試**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock supabase: chainable from() + a Realtime channel.
const insertMock = vi.fn()
const updateMock = vi.fn()
const deleteMock = vi.fn()
const selectMock = vi.fn()
const eqMock = vi.fn()
const orderMock = vi.fn()

const channelOnMock = vi.fn()
const channelSubscribeMock = vi.fn()
const channelMock = { on: channelOnMock, subscribe: channelSubscribeMock }
channelOnMock.mockReturnValue(channelMock)
channelSubscribeMock.mockImplementation((_cb) => channelMock)

const fromMock = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => fromMock(table),
    channel: () => channelMock,
    removeChannel: vi.fn(),
  },
}))

import { usePlacesStore } from '../places'

function setupFrom() {
  // Default: insert/update/delete resolve to { error: null }; select resolves to {data: [], error: null}.
  insertMock.mockResolvedValue({ error: null })
  updateMock.mockResolvedValue({ error: null })
  deleteMock.mockResolvedValue({ error: null })
  orderMock.mockResolvedValue({ data: [], error: null })
  eqMock.mockReturnValue({ order: orderMock })
  selectMock.mockReturnValue({ eq: eqMock })
  fromMock.mockReturnValue({
    insert: insertMock,
    update: () => ({ eq: updateMock }),
    delete: () => ({ eq: deleteMock }),
    select: selectMock,
  })
}

describe('usePlacesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    channelOnMock.mockReturnValue(channelMock)
    channelSubscribeMock.mockImplementation((_cb) => channelMock)
    setupFrom()
  })

  it('starts with empty places and status idle', () => {
    const store = usePlacesStore()
    expect(store.places).toEqual([])
    expect(store.status).toBe('idle')
  })

  it('loadFromCloud() fills state from supabase select', async () => {
    orderMock.mockResolvedValue({
      data: [{ id: 'p1', user_id: 'u1', name: 'X', lat: 35, lng: 129, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 }],
      error: null,
    })
    const store = usePlacesStore()
    await store.loadFromCloud('u1')
    expect(store.places).toHaveLength(1)
    expect(store.places[0].id).toBe('p1')
    expect(store.places[0].categoryId).toBe('cat-food')
  })

  it('addPlace() optimistically pushes then awaits supabase insert', async () => {
    const store = usePlacesStore()
    await store.addPlace('u1', { name: 'A', lat: 35, lng: 129, categoryId: 'cat-food', visited: false })
    expect(store.places).toHaveLength(1)
    expect(insertMock).toHaveBeenCalledTimes(1)
  })

  it('addPlace() reverts state on supabase error', async () => {
    insertMock.mockResolvedValue({ error: { message: 'rls' } })
    const store = usePlacesStore()
    await store.addPlace('u1', { name: 'A', lat: 35, lng: 129, categoryId: 'cat-food', visited: false })
    expect(store.places).toHaveLength(0)
    expect(store.status).toBe('error')
  })

  it('updatePlace() patches state and calls supabase update', async () => {
    const store = usePlacesStore()
    await store.addPlace('u1', { name: 'A', lat: 35, lng: 129, categoryId: 'cat-food', visited: false })
    const id = store.places[0].id
    await store.updatePlace(id, { name: 'B' })
    expect(store.places[0].name).toBe('B')
    expect(updateMock).toHaveBeenCalled()
  })

  it('updatePlace() reverts on supabase error', async () => {
    const store = usePlacesStore()
    await store.addPlace('u1', { name: 'A', lat: 35, lng: 129, categoryId: 'cat-food', visited: false })
    const id = store.places[0].id
    updateMock.mockResolvedValueOnce({ error: { message: 'rls' } })
    await store.updatePlace(id, { name: 'B' })
    expect(store.places[0].name).toBe('A')
  })

  it('deletePlace() removes from state and calls supabase delete', async () => {
    const store = usePlacesStore()
    await store.addPlace('u1', { name: 'A', lat: 35, lng: 129, categoryId: 'cat-food', visited: false })
    const id = store.places[0].id
    await store.deletePlace(id)
    expect(store.places).toHaveLength(0)
    expect(deleteMock).toHaveBeenCalled()
  })

  it('handleChange INSERT adds row not already present', () => {
    const store = usePlacesStore()
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    expect(store.places).toHaveLength(1)
    expect(store.places[0].id).toBe('p2')
  })

  it('handleChange INSERT is idempotent for already-present id', () => {
    const store = usePlacesStore()
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    expect(store.places).toHaveLength(1)
  })

  it('handleChange UPDATE merges into existing row', () => {
    const store = usePlacesStore()
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    store.handleChange({
      eventType: 'UPDATE',
      new: { id: 'p2', user_id: 'u1', name: 'Y2', lat: 1, lng: 2, category_id: 'cat-food', visited: true, created_at: 1, updated_at: 2 },
    })
    expect(store.places[0].name).toBe('Y2')
    expect(store.places[0].visited).toBe(true)
  })

  it('handleChange DELETE removes row by id', () => {
    const store = usePlacesStore()
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    store.handleChange({ eventType: 'DELETE', old: { id: 'p2' } })
    expect(store.places).toHaveLength(0)
  })

  it('reset() clears state and unsubscribes', () => {
    const store = usePlacesStore()
    store.handleChange({
      eventType: 'INSERT',
      new: { id: 'p2', user_id: 'u1', name: 'Y', lat: 1, lng: 2, category_id: 'cat-food', visited: false, created_at: 1, updated_at: 1 },
    })
    store.reset()
    expect(store.places).toEqual([])
  })
})
```

**Step 2：執行測試確認 fail**

Run: `npm run test:run -- places`
Expected: FAIL（舊 places store 沒有這些方法）。

---

## Task 10: 改寫 `places.ts`

**Files:**
- Modify: `src/stores/places.ts`

**Step 1：整檔取代**

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Place } from '@/types'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'

type PlaceRow = {
  id: string
  user_id: string
  name: string
  lat: number
  lng: number
  category_id: string
  note: string | null
  source_url: string | null
  visited: boolean
  created_at: number
  updated_at: number
}

function rowToPlace(r: PlaceRow): Place {
  return {
    id: r.id,
    name: r.name,
    lat: r.lat,
    lng: r.lng,
    categoryId: r.category_id,
    note: r.note ?? undefined,
    sourceUrl: r.source_url ?? undefined,
    visited: r.visited,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function placeToRow(p: Place, userId: string): PlaceRow {
  return {
    id: p.id,
    user_id: userId,
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    category_id: p.categoryId,
    note: p.note ?? null,
    source_url: p.sourceUrl ?? null,
    visited: p.visited,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  }
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'offline'

export const usePlacesStore = defineStore('places', () => {
  const places = ref<Place[]>([])
  const status = ref<'idle' | 'loading' | 'error'>('idle')
  const connection = ref<ConnectionStatus>('offline')
  let channel: RealtimeChannel | null = null
  let currentUserId: string | null = null

  async function loadFromCloud(userId: string) {
    currentUserId = userId
    status.value = 'loading'
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
    if (error) {
      status.value = 'error'
      return
    }
    places.value = (data as PlaceRow[]).map(rowToPlace)
    status.value = 'idle'
  }

  function subscribe(userId: string) {
    currentUserId = userId
    if (channel) return
    channel = supabase
      .channel(`places:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'places', filter: `user_id=eq.${userId}` },
        (payload: { eventType: string; new?: PlaceRow; old?: { id: string } }) =>
          handleChange(payload),
      )
      .subscribe((s: string) => {
        if (s === 'SUBSCRIBED') connection.value = 'connected'
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') {
          connection.value = 'reconnecting'
          if (currentUserId) loadFromCloud(currentUserId)
        } else if (s === 'CLOSED') connection.value = 'offline'
      })
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
    connection.value = 'offline'
  }

  function reset() {
    unsubscribe()
    places.value = []
    currentUserId = null
    status.value = 'idle'
  }

  function handleChange(payload: { eventType: string; new?: PlaceRow; old?: { id: string } }) {
    if (payload.eventType === 'INSERT' && payload.new) {
      if (places.value.some((p) => p.id === payload.new!.id)) return
      places.value.push(rowToPlace(payload.new))
    } else if (payload.eventType === 'UPDATE' && payload.new) {
      const idx = places.value.findIndex((p) => p.id === payload.new!.id)
      if (idx >= 0) places.value[idx] = rowToPlace(payload.new)
    } else if (payload.eventType === 'DELETE' && payload.old) {
      places.value = places.value.filter((p) => p.id !== payload.old!.id)
    }
  }

  async function addPlace(
    userId: string,
    input: Omit<Place, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Place | null> {
    const now = Date.now()
    const place: Place = { ...input, id: uuid(), createdAt: now, updatedAt: now }
    places.value.push(place)
    const { error } = await supabase.from('places').insert(placeToRow(place, userId))
    if (error) {
      places.value = places.value.filter((p) => p.id !== place.id)
      status.value = 'error'
      return null
    }
    return place
  }

  async function updatePlace(
    id: string,
    patch: Partial<Omit<Place, 'id' | 'createdAt'>>,
  ): Promise<void> {
    const idx = places.value.findIndex((p) => p.id === id)
    if (idx < 0) return
    const snapshot = { ...places.value[idx] }
    const now = Date.now()
    const next = { ...snapshot, ...patch, updatedAt: now }
    places.value[idx] = next

    const dbPatch: Partial<PlaceRow> = {
      updated_at: now,
    }
    if (patch.name !== undefined) dbPatch.name = patch.name
    if (patch.lat !== undefined) dbPatch.lat = patch.lat
    if (patch.lng !== undefined) dbPatch.lng = patch.lng
    if (patch.categoryId !== undefined) dbPatch.category_id = patch.categoryId
    if (patch.note !== undefined) dbPatch.note = patch.note ?? null
    if (patch.sourceUrl !== undefined) dbPatch.source_url = patch.sourceUrl ?? null
    if (patch.visited !== undefined) dbPatch.visited = patch.visited

    const { error } = await supabase.from('places').update(dbPatch).eq('id', id)
    if (error) {
      places.value[idx] = snapshot
      status.value = 'error'
    }
  }

  async function deletePlace(id: string): Promise<void> {
    const idx = places.value.findIndex((p) => p.id === id)
    if (idx < 0) return
    const snapshot = places.value[idx]
    places.value.splice(idx, 1)
    const { error } = await supabase.from('places').delete().eq('id', id)
    if (error) {
      places.value.splice(idx, 0, snapshot)
      status.value = 'error'
    }
  }

  return {
    places,
    status,
    connection,
    loadFromCloud,
    subscribe,
    unsubscribe,
    reset,
    handleChange,
    addPlace,
    updatePlace,
    deletePlace,
  }
})
```

**Step 2：執行測試確認 pass**

Run: `npm run test:run -- places`
Expected: PASS（12 個測試）。

**Step 3：暫不 commit。** 接下來 task 會修 caller 端讓 type-check 過。

---

## Task 11: 修復所有 places store 使用端的 type 錯誤

**Files:**
- Modify: `src/components/AddPlaceModal.vue`、`src/components/PlaceDetailSheet.vue`、`src/components/PlaceList.vue`、`src/components/SideDrawer.vue`、其他用到 `places.add/update/remove/setAll` 的檔案。

**Step 1：找出所有呼叫點**

Run: `grep -rn "places\.\(add\|update\|remove\|setAll\)" src/`
Expected: 列出所有需要改動的位置。

**Step 2：逐一修改**

| 舊呼叫 | 新呼叫 |
| --- | --- |
| `places.add({ name, lat, ... })` | `await places.addPlace(authStore.user!.id, { name, lat, ..., visited: false })` |
| `places.update(id, patch)` | `await places.updatePlace(id, patch)` |
| `places.remove(id)` | `await places.deletePlace(id)` |
| `places.setAll(arr)` | **移除**（不再支援；places 來源只有 Supabase） |

需要在 `AddPlaceModal.vue` import `useAuthStore` 並取得 user id 才能 add。
`SideDrawer.vue` 的 exportJson / importJson 仍處理 categories + shoppingItems，**移除** places 相關欄位（importedPlaces、existingPlaceIds 區塊整段刪掉），並把 schemaVersion 改為 3。

**Step 3：型別檢查**

Run: `npm run type-check`
Expected: PASS。

**Step 4：跑全部測試**

Run: `npm run test:run`
Expected: PASS（含 persistence、auth、places 共 25+ 測試）。

**Step 5：Commit**

```bash
git add src/stores/places.ts src/stores/__tests__/places.test.ts src/components/
git commit -m "feat(store,ui): rewrite places store as Supabase cloud + Realtime"
```

---

## Task 12: `AuthModal.vue` 元件

**Files:**
- Create: `src/components/AuthModal.vue`

**Step 1：建立**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const confirm = ref('')
const submitting = ref(false)
const info = ref<string | null>(null)

async function submit() {
  info.value = null
  if (mode.value === 'signup' && password.value !== confirm.value) {
    info.value = '兩次密碼不一致'
    return
  }
  submitting.value = true
  try {
    if (mode.value === 'signin') {
      await auth.signIn(email.value, password.value)
    } else {
      await auth.signUp(email.value, password.value)
      if (!auth.errorMessage) info.value = '註冊成功，請至信箱完成驗證後再登入'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="tabs">
      <button :class="{ active: mode === 'signin' }" @click="mode = 'signin'">登入</button>
      <button :class="{ active: mode === 'signup' }" @click="mode = 'signup'">註冊</button>
    </div>
    <form @submit.prevent="submit" class="form">
      <input v-model="email" type="email" placeholder="email" required autocomplete="email" />
      <input
        v-model="password"
        type="password"
        placeholder="密碼"
        required
        minlength="6"
        :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
      />
      <input
        v-if="mode === 'signup'"
        v-model="confirm"
        type="password"
        placeholder="再次輸入密碼"
        required
        minlength="6"
        autocomplete="new-password"
      />
      <button type="submit" :disabled="submitting">
        {{ mode === 'signin' ? '登入' : '註冊' }}
      </button>
      <p v-if="info" class="info">{{ info }}</p>
      <p v-if="auth.errorMessage" class="error">{{ auth.errorMessage }}</p>
    </form>
  </div>
</template>

<style scoped>
.auth-wrap { padding: 16px; }
.tabs { display: flex; margin-bottom: 16px; }
.tabs button {
  flex: 1; padding: 10px; background: none; border: none;
  font-size: 0.95rem; cursor: pointer; color: #666;
  border-bottom: 2px solid transparent;
}
.tabs button.active { color: #3b82f6; border-bottom-color: #3b82f6; }
.form { display: flex; flex-direction: column; gap: 10px; }
.form input, .form button {
  padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px;
  font-size: 1rem;
}
.form button { background: #3b82f6; color: white; border: none; cursor: pointer; }
.form button:disabled { opacity: 0.5; cursor: not-allowed; }
.info { color: #2563eb; font-size: 0.9rem; margin: 0; }
.error { color: #ef4444; font-size: 0.9rem; margin: 0; }
</style>
```

**Step 2：型別檢查**

Run: `npm run type-check`
Expected: PASS。

**Step 3：Commit**

```bash
git add src/components/AuthModal.vue
git commit -m "feat(ui): add AuthModal for email/password sign in & sign up"
```

---

## Task 13: `AuthGate.vue` 元件

**Files:**
- Create: `src/components/AuthGate.vue`

**Step 1：建立**

```vue
<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import AuthModal from './AuthModal.vue'

const auth = useAuthStore()
</script>

<template>
  <div v-if="auth.status === 'loading'" class="state">載入中…</div>
  <AuthModal v-else-if="auth.status === 'anon'" />
  <div v-else-if="auth.status === 'error'" class="state error">
    <p>{{ auth.errorMessage ?? '初始化失敗' }}</p>
    <button @click="auth.init()">重試</button>
  </div>
  <slot v-else />
</template>

<style scoped>
.state { padding: 24px; text-align: center; color: #666; }
.state.error { color: #ef4444; }
.state button {
  margin-top: 12px; padding: 8px 16px;
  border: 1px solid #ef4444; background: white; color: #ef4444;
  border-radius: 8px; cursor: pointer;
}
</style>
```

**Step 2：型別檢查**

Run: `npm run type-check`
Expected: PASS。

**Step 3：Commit**

```bash
git add src/components/AuthGate.vue
git commit -m "feat(ui): add AuthGate to gate places UI behind login"
```

---

## Task 14: 串接 `main.ts` 與 `SideDrawer.vue`

**Files:**
- Modify: `src/main.ts`
- Modify: `src/components/SideDrawer.vue`
- Modify: `src/App.vue`（如需在 FAB「+」按鈕也擋住未登入時的新增）

**Step 1：修改 `src/main.ts`** — 在 Pinia 註冊後呼叫 `auth.init()`，並在登入狀態變化時觸發 places load/reset。

```ts
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
```

**Step 2：修改 `SideDrawer.vue`**

- 引入 `AuthGate` 與 `useAuthStore`。
- 把 PlaceList 包進 `<AuthGate>`。
- 在 header 區加入登入狀態 + 登出按鈕。
- 移除 exportJson/importJson 中 places 相關欄位（schemaVersion 統一改 3）。

範例片段（header 與 places tab）：

```vue
<header>
  <h2>Trip</h2>
  <button @click="emit('close')" aria-label="關閉">✕</button>
</header>

<div v-if="auth.status === 'authed'" class="account-bar">
  <span class="email">{{ auth.user?.email }}</span>
  <span class="conn" :data-state="places.connection" :title="places.connection"></span>
  <button class="signout" @click="auth.signOut()">登出</button>
</div>

<!-- ... tabs ... -->

<div class="content">
  <AuthGate v-if="tab === 'places'">
    <PlaceList @select="handleSelect" />
  </AuthGate>
  <ShoppingList v-else-if="tab === 'shopping'" />
  <!-- ... settings ... -->
</div>
```

加 CSS：

```css
.account-bar {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; border-bottom: 1px solid #eee;
  font-size: 0.85rem; color: #666;
}
.account-bar .email { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-bar .conn {
  width: 8px; height: 8px; border-radius: 50%;
  background: #ccc;
}
.account-bar .conn[data-state='connected'] { background: #10b981; }
.account-bar .conn[data-state='reconnecting'] { background: #f59e0b; }
.account-bar .conn[data-state='offline'] { background: #ef4444; }
.account-bar .signout {
  background: none; border: 1px solid #ddd; padding: 4px 10px; border-radius: 6px; cursor: pointer;
}
```

**Step 3：修改 `App.vue`**

`AddPlaceModal` 在未登入時應該無法打開。最簡：在 FAB「+」按鈕加 `:disabled="auth.status !== 'authed'"`，或直接在 `openAdd()` 內檢查。

```ts
import { useAuthStore } from '@/stores/auth'
const auth = useAuthStore()

function openAdd() {
  if (auth.status !== 'authed') {
    drawerOpen.value = true  // open drawer so user sees login UI
    return
  }
  editingId.value = null
  modalOpen.value = true
}
```

**Step 4：型別檢查 + 測試**

Run: `npm run type-check && npm run test:run`
Expected: PASS。

**Step 5：Commit**

```bash
git add src/main.ts src/components/SideDrawer.vue src/App.vue
git commit -m "feat(ui): wire auth + places sync into app shell"
```

---

## Task 15: Build 驗證 + 手動 E2E

**Step 1：Build**

Run: `npm run build`
Expected: PASS（無 type error、無未 import）。

**Step 2：跑 dev 並手動測試**

Run: `npm run dev`，在瀏覽器測試以下流程：

- [ ] 未登入時：景點 tab 顯示登入/註冊 UI；FAB「+」打不開新增 modal（會開抽屜）。
- [ ] 註冊新帳號 → 至 Supabase Dashboard 將該 user 標記為 email confirmed（或直接登入）。
- [ ] 登入 → 景點 tab 解鎖、地圖出現。
- [ ] 新增景點 → 馬上看到 marker；Supabase `places` 表也有該筆。
- [ ] 編輯景點 / 切換 visited / 刪除景點 → DB 同步。
- [ ] 開第二個瀏覽器視窗（同帳號），A 視窗新增 / 改 / 刪，B 視窗 <1s 內看到變化。
- [ ] 登出 → 景點 tab 變回登入 UI、本機沒殘留 places。
- [ ] 將電腦離線 → 連線 icon 變橘 → 恢復連線後變綠且資料同步。
- [ ] 購物清單 tab 完全不需要登入仍可用。

**Step 3：若全部通過則收尾**

```bash
git status   # 應為 clean
```

---

## 完成後

- `docs/plans/2026-05-21-supabase-auth-places-sync-design.md` 是設計文件，無需更動。
- 本計畫文件 (`...-sync.md`) 完成後可在 PR 描述附上連結作為紀錄。
- 後續 nice-to-have（**不在本計畫範圍**）：增量 sync、離線編輯佇列、Google OAuth、把 categories / shoppingItems 也搬上雲、圖片上傳到 Supabase Storage。
