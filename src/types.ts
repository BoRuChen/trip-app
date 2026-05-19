export interface Category {
  id: string
  name: string
  icon: string      // lucide icon component name in kebab-case (e.g. 'utensils')
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

export interface ShoppingItem {
  id: string
  name: string
  note?: string
  quantity?: string
  location?: string
  imageIds: string[]
  purchased: boolean
  createdAt: number
}

export interface PersistedState {
  schemaVersion: 2
  categories: Category[]
  places: Place[]
  shoppingItems: ShoppingItem[]
}
