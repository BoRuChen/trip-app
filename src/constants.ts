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
