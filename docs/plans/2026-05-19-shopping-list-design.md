# 購買清單 + 圖片上傳 設計（2026-05-19）

## 需求摘要

在現有的釜山旅行 app 中新增獨立的「購買清單」分頁。每個項目可記錄名稱、備註、數量、購買地點、已購勾選，以及最多 5 張上傳圖片。

**範圍邊界**：
- 購買清單與地圖上的 Place 不互通（購買地點為自由文字，不連結 Place）。
- 不支援多 trip / 雲端 / 分享。

## 資料模型

`src/types.ts` 新增：

```ts
export interface ShoppingItem {
  id: string
  name: string
  note?: string
  quantity?: string       // string 而非 number：可寫「2」「1包」「半斤」
  location?: string       // 自由文字店名
  imageIds: string[]      // 0–5 個，指向 IndexedDB 的 image key
  purchased: boolean
  createdAt: number
}

export interface PersistedState {
  schemaVersion: 2        // 從 1 升到 2
  categories: Category[]
  places: Place[]
  shoppingItems: ShoppingItem[]
}
```

## 儲存分層

| 資料 | 位置 | 說明 |
|---|---|---|
| `ShoppingItem` metadata（含 imageIds） | localStorage `trip:v1` | 沿用現有 persistence |
| 圖片 Blob | IndexedDB（DB `trip-images`、store `images`） | 大檔不適合 localStorage |

- 圖片 ID 用 `crypto.randomUUID()`，不含項目 ID — 未來複製/重排不需搬資料。
- Migration：載入時若 `schemaVersion === 1`，補 `shoppingItems: []` 並升到 2。
- 孤兒清理：刪除項目時同步呼叫 `deleteImages(imageIds)`。

## 圖片儲存層

**`src/stores/imageStore.ts`** — 原生 IndexedDB 薄包裝（無第三方 lib）：

```ts
saveImage(blob: Blob): Promise<string>     // 回 id
loadImage(id: string): Promise<Blob | null>
deleteImage(id: string): Promise<void>
deleteImages(ids: string[]): Promise<void>
```

`openDB` 用 lazy singleton；`images` store 以 `id` 為 keyPath。

## 圖片壓縮與顯示

**`src/composables/useImageCompress.ts`**：

```ts
compressImage(file: File): Promise<Blob>
```

1. `createImageBitmap(file, { imageOrientation: 'from-image' })` — 自動處理 EXIF orientation。
2. canvas 縮放到 max width 1280px（等比、<1280 不放大）。
3. `canvas.toBlob('image/jpeg', 0.85)` — 預期單張 100–300KB。

**`src/composables/useImageUrl.ts`**：

```ts
useImageUrl(imageId: Ref<string>): { url: Ref<string|null> }
```

- mount 時 `loadImage` → `URL.createObjectURL` → 設 url
- unmount 時 `URL.revokeObjectURL` 避免 memory leak
- id 變化時 revoke 舊的、建新的

## 上傳流程（在 AddShoppingItemModal）

1. `<input type="file" accept="image/*" multiple>` 選檔。
2. 已選 + 新選總數 ≤ 5；超過顯示 toast「最多 5 張」。
3. 每張 `compressImage` → `saveImage` → 拿到 id → push 到 `imageIds`。
4. 預覽用壓縮後 blob 直接 `URL.createObjectURL`，省一次讀。
5. 編輯模式：刪掉的 id **送出時才**真刪 IndexedDB，使用者按取消可還原。
6. 壓縮/寫入失敗 → console.error + toast「圖片儲存失敗」，項目其他欄位仍可送出。

## UI 與元件

SideDrawer 內加入 tab 切換（「景點」/「購買清單」），tab 狀態存在 SideDrawer 內部 `ref`，不進 Pinia。

**新元件**：

```
src/components/
├── ShoppingList.vue          // 清單主體
├── ShoppingItemRow.vue       // 單列
└── AddShoppingItemModal.vue  // 新增/編輯共用
```

- `ShoppingList`：頂部「+ 新增」按鈕；分兩段（未購上、已購下灰階+刪除線）；排序 `createdAt` 由新到舊。
- `ShoppingItemRow`：左 48×48 縮圖（首張，無圖顯示 lucide icon）+ 中間名稱/數量/地點 + 右 checkbox。點 row 開編輯 modal。
- `AddShoppingItemModal`：仿 `AddPlaceModal` 版型。欄位：名稱（必填）、數量、購買地點、備註、圖片。圖片區為水平捲動縮圖列 + 末端「+ 加圖」按鈕（≥5 張時隱藏）。
- 不做獨立 detail sheet — 編輯 modal 即檢視介面。

## 測試

| 範圍 | 檔案 | 重點 |
|---|---|---|
| Migration | `stores/__tests__/persistence.test.ts` | v1→v2 補 `shoppingItems`、v2 原樣 |
| Shopping store | `stores/__tests__/shopping.test.ts` | add/update/togglePurchased/delete（delete 觸發 deleteImages） |
| Image compress | `composables/__tests__/useImageCompress.test.ts` | 1280 縮放、<1280 不放大、JPEG output |
| Image store | `stores/__tests__/imageStore.test.ts` | save→load roundtrip、delete |

- IndexedDB 用 `fake-indexeddb`（dev dep）。
- `createImageBitmap` / canvas 在 jsdom 不可用 → `useImageCompress` 測試 mock 掉，只驗 pipeline，不驗像素。
- UI 元件不寫單元測試（沿用既有專案做法）。

## 實作順序

1. `types.ts` 加 `ShoppingItem`、`PersistedState.schemaVersion: 2`、`shoppingItems`。
2. `persistence.ts` migration v1→v2 + 測試。
3. `imageStore.ts` IndexedDB 包裝 + 測試（含 `fake-indexeddb`）。
4. `useImageCompress.ts` + `useImageUrl.ts` composables。
5. `stores/shopping.ts` Pinia store + 測試（delete 連動 `deleteImages`）。
6. `AddShoppingItemModal.vue` + 圖片上傳 UI。
7. `ShoppingList.vue` + `ShoppingItemRow.vue` + `SideDrawer.vue` 加 tab。

每步可獨立 commit、跑測試後再進下一步。
