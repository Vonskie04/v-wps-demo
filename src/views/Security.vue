<template>
  <div
    class="container bg-gray-100 mx-auto min-h-screen flex flex-col items-center justify-center px-4"
  >
    <h2 class="text-sm tracking-widest mb-2">THE WEDDING OF</h2>
    <h1 class="fg text-4xl tracking-wide mb-8">Victor & Denise</h1>

    <div
      class="bg-white rounded-2xl shadow-md w-full max-w-xs p-8 flex flex-col items-center gap-4"
    >
      <p class="text-[11px] text-center text-gray-500 uppercase">
        {{ isPublic ? 'App is currently public' : 'Enter access token to open the app' }}
      </p>

      <template v-if="!isPublic">
        <input
          v-model="tokenInput"
          type="password"
          placeholder="Access token"
          @keyup.enter="submit"
          class="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm text-center tracking-widest outline-none focus:border-[#471417] transition"
        />
        <p v-if="error" class="text-xs text-[#471417]">{{ error }}</p>
        <button @click="submit" class="btn w-full cursor-pointer">UNLOCK</button>
      </template>

      <template v-else>
        <p class="text-xs text-green-700 font-medium tracking-wide">UNLOCKED</p>
        <button @click="goToApp" class="btn w-full cursor-pointer">GO TO APP</button>
        <button
          @click="lock"
          class="text-xs text-gray-400 hover:text-red-600 transition cursor-pointer mt-1 tracking-wide"
        >
          MAKE PRIVATE AGAIN
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePublicStore } from '@/stores/publicStore'

const { isPublic, makePublic, makePrivate } = usePublicStore()
const router = useRouter()

const tokenInput = ref('')
const error = ref('')

const EXPECTED_TOKEN = import.meta.env.VITE_ACCESS_TOKEN as string | undefined

function submit() {
  if (!tokenInput.value.trim()) {
    error.value = 'Please enter an access token.'
    return
  }
  if (!EXPECTED_TOKEN) {
    error.value = 'No access token configured.'
    return
  }
  if (tokenInput.value === EXPECTED_TOKEN) {
    error.value = ''
    makePublic()
  } else {
    error.value = 'Incorrect token.'
    tokenInput.value = ''
  }
}

function lock() {
  makePrivate()
}

function goToApp() {
  router.push('/')
}
</script>

<style scoped></style>
