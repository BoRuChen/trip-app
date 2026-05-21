import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

export type AuthStatus = 'loading' | 'authed' | 'anon' | 'error'

// Module-scoped subscription handle so repeated init() calls don't stack listeners.
let authSubscription: { unsubscribe: () => void } | null = null

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
      // Unsubscribe any previous listener before registering a new one,
      // to avoid duplicate handlers if init() is called more than once.
      if (authSubscription) {
        authSubscription.unsubscribe()
        authSubscription = null
      }
      const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
        applySession(s)
      })
      authSubscription = sub.subscription
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

export function _resetForTest(): void {
  authSubscription = null
}
