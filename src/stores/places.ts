import { defineStore } from 'pinia'
import { ref } from 'vue'
import { v4 as uuid } from 'uuid'
import type { Place } from '@/types'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

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
      .on<PlaceRow>(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'places', filter: `user_id=eq.${userId}` },
        (payload: RealtimePostgresChangesPayload<PlaceRow>) =>
          handleChange({
            eventType: payload.eventType,
            new: 'new' in payload ? (payload.new as PlaceRow) : undefined,
            old: 'old' in payload ? (payload.old as { id: string }) : undefined,
          }),
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
    const existing = places.value[idx]
    // narrowing: noUncheckedIndexedAccess widens to T | undefined despite the idx >= 0 check
    if (!existing) return
    const snapshot: Place = { ...existing }
    const now = Date.now()
    const next: Place = { ...snapshot, ...patch, updatedAt: now }
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
    const existing = places.value[idx]
    // narrowing: noUncheckedIndexedAccess widens to T | undefined despite the idx >= 0 check
    if (!existing) return
    const snapshot: Place = existing
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
