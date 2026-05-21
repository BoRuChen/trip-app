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
