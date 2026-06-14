import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/mirror/harp',
      name: 'mirror-harp',
      component: () => import('../views/MirrorHarpView.vue'),
    },
    {
      path: '/mirror/notes',
      name: 'mirror-notes',
      component: () => import('../views/MirrorNotesView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
