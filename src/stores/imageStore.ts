import { v4 as uuid } from 'uuid'

const DB_NAME = 'trip-images'
const STORE_NAME = 'images'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then((db) => db.transaction(STORE_NAME, mode).objectStore(STORE_NAME))
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveImage(blob: Blob): Promise<string> {
  const id = uuid()
  await saveImageWithId(id, blob)
  return id
}

export async function saveImageWithId(id: string, blob: Blob): Promise<void> {
  const buffer = await blob.arrayBuffer()
  const store = await tx('readwrite')
  await wrap(store.put({ id, buffer, type: blob.type }))
}

export async function loadImage(id: string): Promise<Blob | null> {
  const store = await tx('readonly')
  const rec = await wrap<{ id: string; buffer: ArrayBuffer; type: string } | undefined>(
    store.get(id),
  )
  return rec ? new Blob([rec.buffer], { type: rec.type }) : null
}

export async function deleteImage(id: string): Promise<void> {
  const store = await tx('readwrite')
  await wrap(store.delete(id))
}

export async function deleteImages(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const db = await openDB()
  const transaction = db.transaction(STORE_NAME, 'readwrite')
  const store = transaction.objectStore(STORE_NAME)
  ids.forEach((id) => store.delete(id))
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function clearAllImages(): Promise<void> {
  const store = await tx('readwrite')
  await wrap(store.clear())
}

export async function _resetForTest(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise
    db.close()
    dbPromise = null
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
    req.onblocked = () => resolve()
  })
}
