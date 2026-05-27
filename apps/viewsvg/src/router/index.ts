import { createRouter, createWebHistory } from 'vue-router'

import ViewSvgView from '@/views/ViewSvgView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'viewsvg',
      component: ViewSvgView,
    },
  ],
})

export default router
