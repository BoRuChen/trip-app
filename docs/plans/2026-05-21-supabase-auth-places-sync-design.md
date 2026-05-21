# Supabase 登入 + 景點雲端同步 設計（2026-05-21）

## 需求摘要

在現有的釜山旅行 app 加入 Supabase 帳號系統，將**景點 (places)** 資料綁定到使用者帳號並雲端儲存，支援多裝置即時同步（電腦新增，手機 <1s 內看到）。

**範圍邊界**：

- **同步範圍**：只有 `places`。`categories` 與 `shoppingItems` 仍只存本機（localStorage / IndexedDB）。
- **登入門檻**：景點 tab 需登入才能使用；購物清單與分類維持本地、未登入仍可用。
- **登入方式**：Email + 密碼（首版不做 OAuth、不做 Magic Link）。
- **同步策略**：雲端為單一真實來源（cloud-first）。本機景點不再持久化；App 啟動後 `select` 全部 + Realtime 訂閱推播。
- **衝突處理**：後寫者勝（DB row 直接覆蓋）。
- **不做**：圖片同步、Supabase Storage、增量 sync（`updated_at > lastSyncedAt`）、離線編輯佇列、Email 驗證強制。

## 整體架構

### 新增依賴

- `@supabase/supabase-js`

### 新增檔案

- `src/lib/supabase.ts` — Supabase client 單例，從 `import.meta.env.VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 讀取設定。
- `src/stores/auth.ts` — Pinia store，管理 `user`、`session`、登入註冊登出、`onAuthStateChange` 訂閱。
- `src/components/AuthGate.vue` — 包住景點 tab 的閘門元件，依 `auth.status` 切換渲染。
- `src/components/AuthModal.vue` — 登入 / 註冊 UI（嵌入式，不是彈窗）。

### 修改檔案

- `src/types.ts`
  - `Place` 加 `updatedAt: number`（顯示用，非同步用）。
  - `PersistedState.schemaVersion` 升到 3，移除 `places` 欄位（只剩 `categories`、`shoppingItems`）。
- `src/stores/places.ts` — **整體重寫**：
  - 移除 localStorage 持久化。
  - 新增 `loadFromCloud()`、`subscribe()`、`unsubscribe()`、`reset()`。
  - mutations 改為直接呼叫 Supabase（optimistic update + 失敗 revert）。
- `src/stores/persistence.ts` — 只負責 `categories` + `shoppingItems`；schema 3 migration 移除舊版 `places` 欄位。
- `src/main.ts` — 啟動時 `auth.init()`；session 存在時自動觸發 places load + subscribe。
- `src/App.vue` / `src/components/SideDrawer.vue` — 景點 tab 外層包 `<AuthGate>`；header 顯示 email + 連線狀態 + 登出。

### 移除

- 原規劃的獨立 `sync.ts`（cloud-first 不需要合併邏輯）。
- `Place.deleted_at` 軟刪除（Realtime 會送 DELETE 事件，硬刪即可）。
- 「第一次登入合併本地與雲端」流程（不再有可同步的本機 places）。

## Supabase Schema 與 RLS

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
  created_at bigint not null,           -- ms timestamp，與前端一致
  updated_at bigint not null            -- ms timestamp
);

create index places_user_idx on public.places (user_id);

-- Realtime 必須開啟 replication
alter publication supabase_realtime add table public.places;

-- RLS：使用者只能存取自己的資料
alter table public.places enable row level security;

create policy "own places - all" on public.places
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

**設計取捨**：

- `id` 沿用前端 uuid（不是 Supabase auto-id），方便 optimistic insert 直接帶 id。
- 時間戳用 `bigint` (ms)，與前端 `Date.now()` 對齊，省去 timezone 轉換。
- 單一 `for all` policy 涵蓋 select/insert/update/delete，比四條更簡潔。

**`category_id` 處理**：仍是本地 category 的字串 id。換裝置時若該 id 在本機分類列表找不到，PlaceMarker / PlaceList 顯示為灰色「未分類」chip，不阻擋顯示與編輯。

## 認證流程

### `src/stores/auth.ts`

```ts
state: {
  user: User | null
  session: Session | null
  status: 'loading' | 'authed' | 'anon' | 'error'
  errorMessage: string | null
}

actions: {
  init()              // 啟動時呼叫
  signUp(email, pw)
  signIn(email, pw)
  signOut()
}
```

### `init()` 流程

1. `status = 'loading'`。
2. `supabase.auth.getSession()` 取本地 session。
3. 有 session → `status = 'authed'`，觸發 `placesStore.loadFromCloud()` + `placesStore.subscribe()`。
4. 沒 session → `status = 'anon'`。
5. 訂閱 `onAuthStateChange`：
   - `SIGNED_IN` → load + subscribe。
   - `SIGNED_OUT` → `placesStore.reset()`（清空 state + unsubscribe）。

### `AuthGate.vue`（包在景點 tab 外層）

| `auth.status` | 渲染 |
| --- | --- |
| `loading` | Spinner |
| `anon` | `<AuthModal>`（嵌入式） |
| `authed` | `<slot/>`（PlaceList / MapView） |
| `error` | 錯誤訊息 + 重試按鈕 |

### `AuthModal.vue`

- Tab 切換：登入 / 註冊。
- 欄位：email、password（註冊多 confirm）。
- 顯示 `auth.errorMessage`。
- 註冊成功 → 提示「請至信箱完成驗證」（首版不強制驗證才能登入）。

### Header 顯示（SideDrawer 頂部）

- `authed`：email + 連線狀態 icon（綠＝已連線、橘＝重連中、紅＝斷線）+ 登出按鈕。
- `anon`：空白（景點 tab 內已有登入 UI）。

## 雲端 CRUD + Realtime

### `src/stores/places.ts` 介面

```ts
state: {
  places: Place[]
  status: 'idle' | 'loading' | 'error'
  connection: 'connected' | 'reconnecting' | 'offline'
  channel: RealtimeChannel | null
}

actions: {
  loadFromCloud()
  subscribe()
  unsubscribe()
  reset()
  addPlace(input)
  updatePlace(id, patch)
  deletePlace(id)
}
```

### CRUD 寫入策略：optimistic update

以 `addPlace` 為例：

1. 產生 `id`、`createdAt`、`updatedAt`（前端 uuid + `Date.now()`）。
2. 立即 push 到 `state.places`（畫面馬上更新）。
3. `await supabase.from('places').insert({...})`。
4. 失敗 → 從 state 移除該筆 + `status = 'error'` + toast。

`updatePlace` / `deletePlace` 同理，失敗時 revert 回原值（呼叫前先存 snapshot）。

### Realtime 訂閱

```ts
channel = supabase.channel(`places:${userId}`)
  .on('postgres_changes',
      { event: '*', schema: 'public', table: 'places',
        filter: `user_id=eq.${userId}` },
      handleChange)
  .subscribe((status) => { connection = mapStatus(status) })
```

### `handleChange(payload)`

| event | 處理 |
| --- | --- |
| `INSERT` | 若 `state.places` 已有同 id（自己 optimistic 加的）跳過；否則 push |
| `UPDATE` | 以 id 找到並 merge（自己改的 echo 也安全，idempotent） |
| `DELETE` | 以 id 移除 |

判定「是不是自己這台」靠 id 比對即可，不需要 client id。

### 重連

Realtime SDK 會自動重連。重連成功事件觸發一次 `loadFromCloud()` 補回斷線期間漏掉的變更（places 數量小，全抓可接受）。

## 邊界情況

| 情況 | 處理 |
| --- | --- |
| `category_id` 在本機分類找不到 | 顯示為灰色「未分類」chip，不阻擋顯示與編輯 |
| 同時在兩裝置編輯同一筆 | 後寫者勝（DB row 直接覆蓋） |
| Optimistic insert 失敗（網路斷） | 從 state 移除 + toast「新增失敗，請稍後再試」；不進 retry queue |
| Realtime 斷線 | UI 顯示橘色 reconnecting icon；SDK 自動重連 |
| 重連後可能漏事件 | 重連 callback 觸發一次 `loadFromCloud()` 整批刷新 |
| 註冊未驗證 email | 沿用 Supabase 預設（允許登入），首版不擋 |
| token 過期 | SDK 自動 refresh；refresh 失敗 → `SIGNED_OUT` → AuthGate 顯示登入 UI |

## 測試策略

### 單元測試

- **`auth.ts`**：mock `supabase.auth`，驗證
  - `init()` 三條分支（有 session / 無 session / error）。
  - `onAuthStateChange` 觸發 places load / reset。
- **`places.ts`**：mock `supabase.from()`，驗證
  - Optimistic add / update / delete 成功流程。
  - 失敗時 state 回滾。
  - `handleChange` 三種事件對 state 的影響。
  - 重複 INSERT（自己 echo）的 idempotent。

### 元件測試

- **`AuthGate.vue`**：依 `auth.status` 渲染對應子元件。

### 手動 E2E

- 兩個瀏覽器視窗登入同帳號：A 新增 / 修改 / 刪除景點，B 在 <1s 內看到變化。
- 登出後本機不殘留景點；重新登入後自動拉回。

**不寫整合測試**（不打真實 Supabase）：CI 上會 flaky，留給手動 E2E。

## 環境變數

`.env.local`（不進 git）：

```
VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

`.env.example` 提交範本。