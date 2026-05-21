<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import AuthModal from './AuthModal.vue'

const auth = useAuthStore()
</script>

<template>
  <div v-if="auth.status === 'loading'" class="state">載入中…</div>
  <AuthModal v-else-if="auth.status === 'anon'" />
  <div v-else-if="auth.status === 'error'" class="state error">
    <p>{{ auth.errorMessage ?? '初始化失敗' }}</p>
    <button @click="auth.init()">重試</button>
  </div>
  <slot v-else />
</template>

<style scoped>
.state { padding: 24px; text-align: center; color: #666; }
.state.error { color: #ef4444; }
.state button {
  margin-top: 12px; padding: 8px 16px;
  border: 1px solid #ef4444; background: white; color: #ef4444;
  border-radius: 8px; cursor: pointer;
}
</style>
