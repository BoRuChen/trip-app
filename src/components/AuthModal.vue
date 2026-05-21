<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const mode = ref<'signin' | 'signup'>('signin')
const email = ref('')
const password = ref('')
const confirm = ref('')
const submitting = ref(false)
const info = ref<string | null>(null)

async function submit() {
  info.value = null
  if (mode.value === 'signup' && password.value !== confirm.value) {
    info.value = '兩次密碼不一致'
    return
  }
  submitting.value = true
  try {
    if (mode.value === 'signin') {
      await auth.signIn(email.value, password.value)
    } else {
      await auth.signUp(email.value, password.value)
      if (!auth.errorMessage) info.value = '註冊成功，請至信箱完成驗證後再登入'
    }
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="tabs">
      <button :class="{ active: mode === 'signin' }" @click="mode = 'signin'">登入</button>
      <button :class="{ active: mode === 'signup' }" @click="mode = 'signup'">註冊</button>
    </div>
    <form @submit.prevent="submit" class="form">
      <input v-model="email" type="email" placeholder="email" required autocomplete="email" />
      <input
        v-model="password"
        type="password"
        placeholder="密碼"
        required
        minlength="6"
        :autocomplete="mode === 'signin' ? 'current-password' : 'new-password'"
      />
      <input
        v-if="mode === 'signup'"
        v-model="confirm"
        type="password"
        placeholder="再次輸入密碼"
        required
        minlength="6"
        autocomplete="new-password"
      />
      <button type="submit" :disabled="submitting">
        {{ mode === 'signin' ? '登入' : '註冊' }}
      </button>
      <p v-if="info" class="info">{{ info }}</p>
      <p v-if="auth.errorMessage" class="error">{{ auth.errorMessage }}</p>
    </form>
  </div>
</template>

<style scoped>
.auth-wrap { padding: 16px; }
.tabs { display: flex; margin-bottom: 16px; }
.tabs button {
  flex: 1; padding: 10px; background: none; border: none;
  font-size: 0.95rem; cursor: pointer; color: #666;
  border-bottom: 2px solid transparent;
}
.tabs button.active { color: #3b82f6; border-bottom-color: #3b82f6; }
.form { display: flex; flex-direction: column; gap: 10px; }
.form input, .form button {
  padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px;
  font-size: 1rem;
}
.form button { background: #3b82f6; color: white; border: none; cursor: pointer; }
.form button:disabled { opacity: 0.5; cursor: not-allowed; }
.info { color: #2563eb; font-size: 0.9rem; margin: 0; }
.error { color: #ef4444; font-size: 0.9rem; margin: 0; }
</style>
