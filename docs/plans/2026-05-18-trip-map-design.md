# Busan Trip 地圖紀錄 App — 設計文件

日期：2026-05-18

## 目標

為單一趟釜山旅行打造一個地圖紀錄工具。可以加入有興趣的景點座標、用分類 icon 在地圖上呈現，並能取得當前位置去看附近有什麼景點。

## 範圍與決策摘要

| 項目 | 選擇 |
|---|---|
| 使用範圍 | 只給 Busan 這趟旅行用 |
| 資料儲存 | 瀏覽器 localStorage（不需後端） |
| 地圖服務 | Leaflet + OpenStreetMap（免費、不需 API key） |
| 分類設計 | 系統預設一組分類，可新增/編輯/刪除 |
| 附近呈現 | 地圖上顯示位置 + 1km 圓圈聚焦 |
| 新增方式 | 貼 Google Maps 連結自動解析座標 |
| 主要裝置 | 手機為主（mobile-first） |

## 技術棧

- Vue 3 + Vite + TypeScript（沿用現有空專案）
- Leaflet + OpenStreetMap tiles
- Pinia（狀態管理，搭配 localStorage 持久化）
- Lucide Icons（`lucide-vue-next`）
- 原生 CSS + CSS variables（不引入大型 UI 框架）

## 整體頁面結構（單頁應用）

```
┌─────────────────────────┐
│  ☰  Busan Trip      ＋ │  ← 上方 header
├─────────────────────────┤
│                         │
│      [ Leaflet 地圖 ]    │  ← 主畫面，全螢幕地圖
│        ● 你的位置        │
│        ★ 你的景點 markers│
│                         │
│                  ⊕ 定位 │  ← 右下浮動定位按鈕
│                         │
└─────────────────────────┘
```

- ☰：左上選單，開啟側拉抽屜（景點列表、分類管理、匯出/匯入）
- ＋：右上新增景點（modal）
- ⊕：右下定位按鈕，移到當前位置並高亮 1km 內景點
- 點 marker 開啟底部 sheet（詳情/編輯/刪除）

## 資料模型

```ts
// src/types.ts

export interface Category {
  id: string           // uuid
  name: string         // 例：「美食」
  icon: string         // Lucide icon 名稱，例：'utensils'
  color: string        // hex，例：'#ef4444'
  isDefault: boolean   // true = 系統預設（不可刪，但可改 icon/顏色）
}

export interface Place {
  id: string
  name: string
  lat: number
  lng: number
  categoryId: string
  note?: string
  sourceUrl?: string   // 原始 Google Maps 連結
  visited: boolean
  createdAt: number
}
```

### 預設分類

| name | icon (lucide) | color |
|---|---|---|
| 美食 | `utensils` | `#ef4444` |
| 咖啡甜點 | `coffee` | `#a16207` |
| 景點 | `camera` | `#3b82f6` |
| 購物 | `shopping-bag` | `#ec4899` |
| 住宿 | `bed` | `#8b5cf6` |
| 交通 | `train` | `#10b981` |

### 持久化

- localStorage key：`trip:v1`
- 內容：`{ places, categories, schemaVersion: 1 }`
- 每次 mutation 後 debounce 300ms 寫入
- `schemaVersion` 預留未來 migration

### 匯出 / 匯入

- 匯出：下載 `trip-YYYY-MM-DD.json`
- 匯入：選檔 → 預覽筆數 → 「合併 / 覆蓋」二選一

## 核心功能

### 1. 新增景點（Google Maps URL 解析）

支援的格式：
- `https://maps.app.goo.gl/xxx`（短網址，需 follow redirect — 瀏覽器端受 CORS 限制，初版請使用者貼展開後連結）
- `https://www.google.com/maps/place/<name>/@lat,lng,zoom`
- `https://www.google.com/maps/?q=lat,lng`
- 純座標 `35.1531, 129.1187`（fallback）

解析失敗時顯示提示並露出手動座標欄位。

### 2. 地圖呈現

- Tile：`https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- 初始 view：釜山中心 `[35.1796, 129.0756]`, zoom 12
- Marker：用 `L.divIcon` 客製化（分類 icon + 顏色背景圓圈）
- 「已去過」marker 透明度降為 0.5
- 點 marker → bottom sheet 顯示詳情、編輯、刪除、用 Google Maps 導航

### 3. 附近探索

點右下 ⊕：
1. 呼叫 `navigator.geolocation.getCurrentPosition`
2. 地圖 panTo 當前位置，zoom 15
3. 顯示藍色脈動圓點代表使用者
4. 畫出 1km 半徑半透明圓圈（`L.circle`）
5. 圓圈外的 marker 透明度降為 0.3，圓圈內維持滿透明
6. 失敗時 toast 提示「無法取得位置，請允許定位權限」

### 4. 側拉抽屜（☰）

- 景點列表（依分類折疊、可搜尋）
- 分類管理（新增 / 改 icon / 改顏色 / 刪除自訂分類）
- 匯出 / 匯入 JSON
- 「清除所有資料」（二次確認）

## 檔案結構

```
src/
  main.ts
  App.vue                  ← <MapView /> + 全域 modal/sheet
  types.ts                 ← Category, Place 型別
  constants.ts             ← 預設分類、釜山中心座標、storage key

  stores/
    categories.ts          ← Pinia store
    places.ts              ← Pinia store
    persistence.ts         ← localStorage 讀寫 + debounce + migration

  composables/
    useGeolocation.ts      ← 包裝 navigator.geolocation
    useMapsUrlParser.ts    ← Google Maps URL → {lat, lng, name?}

  components/
    MapView.vue            ← 主地圖
    PlaceMarker.ts         ← L.divIcon 工廠
    AddPlaceModal.vue      ← 新增 / 編輯景點
    PlaceDetailSheet.vue   ← 底部 sheet
    SideDrawer.vue         ← 左側抽屜
    CategoryManager.vue    ← 分類 CRUD
    PlaceList.vue          ← 景點列表
    LucideIcon.vue         ← icon 渲染元件
```

## 實作順序（建議分 7 個 commit）

1. 安裝相依：`leaflet`、`@types/leaflet`、`pinia`、`lucide-vue-next`、`uuid`
2. 建型別、預設分類常數、Pinia stores + localStorage 持久化（純資料層）
3. `MapView.vue`：地圖能跑起來、顯示釜山中心
4. 新增景點 modal + Google Maps URL parser（**寫單元測試**）
5. Marker 渲染 + bottom sheet
6. 定位按鈕 + 1km 圓圈 + 聚焦邏輯
7. 側拉抽屜：景點列表、分類管理、匯出/匯入

## 技術細節注意事項

- **Leaflet CSS**：`main.ts` 要 import `leaflet/dist/leaflet.css`
- **Leaflet 預設 marker 圖示**：Vite 打包後路徑會壞 → 用 `divIcon` 客製繞過
- **iOS Safari 定位**：必須 HTTPS 或 localhost，且需「使用者明確點按鈕」才會跳權限視窗
- **Google Maps 短網址**：瀏覽器端 fetch 會被 CORS 擋，初版不支援自動展開
- **localStorage 上限約 5MB**：純文字 JSON 每筆約 200 bytes，撐到上萬筆沒問題

## YAGNI — 刻意省略

多 trip 切換、雲端同步、登入、社群分享、相片上傳、行程規劃路線、PWA 離線支援。這些之後想加再加。