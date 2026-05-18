import L from 'leaflet'
import type { Category } from '@/types'

// Inline lucide-style SVG path strings keyed by icon name from DEFAULT_CATEGORIES.
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
