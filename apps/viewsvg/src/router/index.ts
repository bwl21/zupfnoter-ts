import { createRouter, createWebHistory } from 'vue-router'

import ViewSvgView from '@/views/ViewSvgView.vue'
import ViewPdfView from '@/views/ViewPdfView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'viewsvg',
      component: ViewSvgView,
    },
    {
      path: '/pdf',
      name: 'viewpdf',
      component: ViewPdfView,
    },
  ],
})

export default router
