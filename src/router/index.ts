import { createRouter, createWebHistory } from 'vue-router'
import { usePublicStore } from '@/stores/publicStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Main',
      component: () => import('../views/Main.vue'),
    },
    {
      path: '/gallery',
      name: 'Gallery',
      component: () => import('../views/Gallery.vue'),
    },
    {
      path: '/security',
      name: 'Security',
      component: () => import('../views/Security.vue'),
    },
  ],
})

router.beforeEach((to) => {
  const { isPublic } = usePublicStore()
  if (!isPublic.value && to.name !== 'Security') {
    return { name: 'Security' }
  }
})

export default router
